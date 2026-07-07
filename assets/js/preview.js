// Glitchlet — Live preview: rewrites project files into data: URIs for the sandboxed iframe.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

function queuePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreview, 200);
}

// Preview assets are inlined as data: URIs instead of blob: URLs so the
// preview iframe can run in an opaque origin (sandbox without
// allow-same-origin). Blob URLs cannot be fetched from an opaque origin;
// data: URIs can. The cache avoids re-encoding unchanged (mostly binary)
// files on every preview render.
const dataUrlCache = new WeakMap();

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function createAssetUrl(file, overrideMime) {
  const mime = overrideMime || file.mime || fileMime(file.path);
  const cached = dataUrlCache.get(file);
  if (cached && cached.data === file.data && cached.mime === mime) {
    return cached.url;
  }
  const bytes = file.kind === "binary"
    ? new Uint8Array(file.data)
    : new TextEncoder().encode(String(file.data ?? ""));
  const url = `data:${mime};base64,${bytesToBase64(bytes)}`;
  dataUrlCache.set(file, { data: file.data, mime, url });
  return url;
}

function isRelativeUrl(url) {
  return !/^(https?:|data:|blob:|#|mailto:|tel:|\/\/)/i.test(url);
}

function isAbsolutePath(url) {
  return url.startsWith("/") && !url.startsWith("//");
}

function rewriteCss(cssText, baseDir, warnings, seenCss = new Set()) {
  // Inline `@import "file.css";` / `@import url(file.css) media;` by
  // recursively rewriting the imported stylesheet. seenCss breaks cycles.
  const importRe = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)([^;]*);/gi;
  let updated = cssText.replace(importRe, (match, q1, urlA, q3, urlB, media) => {
    const spec = (urlA || urlB || "").trim();
    if (!spec || !isRelativeUrl(spec)) return match;
    if (isAbsolutePath(spec)) {
      warnings.add(`Absolute path in CSS: ${spec}`);
      return match;
    }
    const resolved = resolvePath(baseDir, spec);
    const file = getFile(resolved);
    if (!file || file.kind === "binary") return match;
    if (seenCss.has(resolved)) return "";
    seenCss.add(resolved);
    const inner = rewriteCss(String(file.data || ""), dirname(resolved), warnings, seenCss);
    const assetUrl = createAssetUrl({ ...file, data: inner, kind: "text" }, "text/css");
    return `@import url(${assetUrl})${media || ""};`;
  });
  updated = updated.replace(/url\(([^)]+)\)/g, (match, raw) => {
    let url = raw.trim().replace(/^['"]|['"]$/g, "");
    if (!url || !isRelativeUrl(url)) return match;
    if (isAbsolutePath(url)) {
      warnings.add(`Absolute path in CSS: ${url}`);
      return match;
    }
    const resolved = resolvePath(baseDir, url);
    const file = getFile(resolved);
    if (!file) return match;
    const assetUrl = createAssetUrl(file);
    return `url(${assetUrl})`;
  });
  return updated;
}

function rewriteSrcset(value, baseDir, warnings) {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      const [url, ...descriptors] = trimmed.split(/\s+/);
      if (!url || !isRelativeUrl(url)) return trimmed;
      if (isAbsolutePath(url)) {
        warnings.add(`Absolute path in HTML: ${url}`);
        return trimmed;
      }
      const file = getFile(resolvePath(baseDir, url));
      if (!file) return trimmed;
      return [createAssetUrl(file), ...descriptors].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function rewriteJsImports(jsText, baseDir, warnings, jsUrlCache) {
  const replaceSpec = (spec) => {
    if (!spec || !isRelativeUrl(spec)) return spec;
    if (isAbsolutePath(spec)) {
      warnings.add(`Absolute path in JS import: ${spec}`);
      return spec;
    }
    const resolved = resolvePath(baseDir, spec);
    const file = getFile(resolved);
    if (!file || file.kind === "binary") return spec;
    const ext = extname(resolved);
    if (ext === "js") {
      return createJsAssetUrl(file, dirname(resolved), warnings, jsUrlCache);
    }
    return createAssetUrl(file);
  };

  const staticImport = /(import|export)\s+(?:[^'"]*?\sfrom\s*)?["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;

  let updated = jsText.replace(staticImport, (match, keyword, spec) => {
    const replaced = replaceSpec(spec);
    return match.replace(spec, replaced);
  });
  updated = updated.replace(dynamicImport, (match, spec) => {
    const replaced = replaceSpec(spec);
    return `import("${replaced}")`;
  });
  return updated;
}

function createJsAssetUrl(file, baseDir, warnings, jsUrlCache) {
  if (jsUrlCache.has(file.path)) {
    return jsUrlCache.get(file.path);
  }
  const jsText = file.kind === "binary" ? "" : String(file.data || "");
  const updated = rewriteJsImports(jsText, baseDir, warnings, jsUrlCache);
  const assetUrl = createAssetUrl({ ...file, data: updated, kind: "text" }, "text/javascript");
  jsUrlCache.set(file.path, assetUrl);
  return assetUrl;
}

function rewriteDocument(doc, htmlPath, warnings) {
  const baseDir = dirname(htmlPath);
  const jsUrlCache = new Map();

  const linkNodes = Array.from(doc.querySelectorAll("link[href]"));
  for (const link of linkNodes) {
    const href = link.getAttribute("href");
    if (!href || !isRelativeUrl(href)) continue;
    if (isAbsolutePath(href)) {
      warnings.add(`Absolute path in HTML: ${href}`);
      continue;
    }
    const resolved = resolvePath(baseDir, href);
    const file = getFile(resolved);
    if (!file) continue;
    if (link.rel === "stylesheet") {
      const cssText = file.kind === "binary" ? "" : String(file.data || "");
      const updatedCss = rewriteCss(cssText, dirname(resolved), warnings, new Set([resolved]));
      const assetUrl = createAssetUrl({ ...file, data: updatedCss, kind: "text" }, "text/css");
      link.setAttribute("href", assetUrl);
    } else {
      link.setAttribute("href", createAssetUrl(file));
    }
  }

  const scriptNodes = Array.from(doc.querySelectorAll("script[src]"));
  for (const script of scriptNodes) {
    const src = script.getAttribute("src");
    if (!src || !isRelativeUrl(src)) continue;
    if (isAbsolutePath(src)) {
      warnings.add(`Absolute path in HTML: ${src}`);
      continue;
    }
    const resolved = resolvePath(baseDir, src);
    const file = getFile(resolved);
    if (!file) continue;
    const isModule = (script.getAttribute("type") || "").toLowerCase() === "module";
    if (isModule && extname(resolved) === "js") {
      script.setAttribute("src", createJsAssetUrl(file, dirname(resolved), warnings, jsUrlCache));
    } else {
      script.setAttribute("src", createAssetUrl(file));
    }
  }

  const srcNodes = Array.from(doc.querySelectorAll("[src]"));
  for (const node of srcNodes) {
    if (node.tagName === "SCRIPT") continue;
    const src = node.getAttribute("src");
    if (!src || !isRelativeUrl(src)) continue;
    if (isAbsolutePath(src)) {
      warnings.add(`Absolute path in HTML: ${src}`);
      continue;
    }
    const resolved = resolvePath(baseDir, src);
    const file = getFile(resolved);
    if (!file) continue;
    node.setAttribute("src", createAssetUrl(file));
  }

  const srcsetNodes = Array.from(doc.querySelectorAll("[srcset]"));
  for (const node of srcsetNodes) {
    const srcset = node.getAttribute("srcset");
    if (!srcset) continue;
    node.setAttribute("srcset", rewriteSrcset(srcset, baseDir, warnings));
  }

  const posterNodes = Array.from(doc.querySelectorAll("[poster]"));
  for (const node of posterNodes) {
    const poster = node.getAttribute("poster");
    if (!poster || !isRelativeUrl(poster)) continue;
    if (isAbsolutePath(poster)) {
      warnings.add(`Absolute path in HTML: ${poster}`);
      continue;
    }
    const file = getFile(resolvePath(baseDir, poster));
    if (!file) continue;
    node.setAttribute("poster", createAssetUrl(file));
  }

  const inlineStyleNodes = Array.from(doc.querySelectorAll("[style]"));
  for (const node of inlineStyleNodes) {
    const styleText = node.getAttribute("style");
    if (!styleText || !styleText.includes("url(")) continue;
    node.setAttribute("style", rewriteCss(styleText, baseDir, warnings));
  }

  const styleNodes = Array.from(doc.querySelectorAll("style"));
  for (const style of styleNodes) {
    const cssText = style.textContent || "";
    const updatedCss = rewriteCss(cssText, baseDir, warnings);
    style.textContent = updatedCss;
  }
}

function renderPreview() {
  const warnings = new Set();
  const htmlFile = getFile("index.html") || Array.from(state.files.values()).find((file) => file.path.endsWith(".html"));
  let html = "<!doctype html><html><body><p>No HTML file found.</p></body></html>";
  let htmlPath = "index.html";

  if (htmlFile && htmlFile.kind !== "binary") {
    html = htmlFile.data;
    htmlPath = htmlFile.path;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  rewriteDocument(doc, htmlPath, warnings);

  const output = "<!doctype html>\n" + doc.documentElement.outerHTML;
  elements.previewFrame.srcdoc = output;

  if (warnings.size) {
    elements.previewWarnings.textContent = `Warnings: ${Array.from(warnings).join(" | ")}`;
  } else {
    elements.previewWarnings.textContent = "";
  }
}
