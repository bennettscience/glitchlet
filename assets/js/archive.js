// Glitchlet — ZIP/TGZ import, export, starter template, and publishing.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("Failed to load JSZip"));
    document.head.appendChild(script);
  });
}

async function ensurePako() {
  if (window.pako) return window.pako;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js";
    script.onload = () => resolve(window.pako);
    script.onerror = () => reject(new Error("Failed to load Pako"));
    document.head.appendChild(script);
  });
}

async function ensureUntarSync() {
  if (window.untar) return window.untar;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/untar-sync@1.0.3/dist/untar.js";
    script.onload = () => resolve(window.untar);
    script.onerror = () => reject(new Error("Failed to load untar"));
    document.head.appendChild(script);
  });
}

function computeImportRootPrefix(paths) {
  const candidates = paths.filter((path) => path.includes("/"));
  if (!candidates.length) return "";
  const firstSegment = candidates[0].split("/")[0];
  if (!firstSegment) return "";
  const allInSameRoot = candidates.every((path) => path.startsWith(`${firstSegment}/`));
  if (!allInSameRoot) return "";
  return `${firstSegment}/`;
}

function computeDirSet(paths) {
  const dirs = new Set();
  for (const path of paths) {
    const parts = path.split("/");
    if (parts.length < 2) continue;
    let current = "";
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      dirs.add(current);
    }
  }
  return dirs;
}

function stripLeadingSlashUrls(content) {
  return content
    .replace(/(href|src)=([\"'])\/(?!\/)/gi, "$1=$2")
    .replace(/url\((['"]?)\/(?!\/)/gi, "url($1");
}

async function importZip(file) {
  try {
    const JSZip = await ensureJSZip();
    const zip = await JSZip.loadAsync(file);
    await applyZipContents(zip);
    renderFileTree();
    openFirstFile();
    queueSave();
    queuePreview();
  } catch (error) {
    console.error(error);
    await showAlert("Import failed. Check the console for details.", "Import");
  }
}

async function applyZipContents(zip) {
  state.files = new Map();
  state.editorDocs = new Map();
  const entries = Object.keys(zip.files);
  const fileEntries = [];
  for (const path of entries) {
    const entry = zip.files[path];
    if (entry.dir) continue;
    const normalized = normalizePath(path);
    if (!normalized || isHiddenPath(normalized)) {
      continue;
    }
    fileEntries.push({ entry, path: normalized });
  }
  const paths = fileEntries.map(({ path }) => path);
  const rootPrefix = computeImportRootPrefix(paths);
  const dirSet = computeDirSet(paths);

  for (const item of fileEntries) {
    const entry = item.entry;
    const normalized = rootPrefix && item.path.startsWith(rootPrefix)
      ? item.path.slice(rootPrefix.length)
      : item.path;
    if (!normalized || isHiddenPath(normalized) || dirSet.has(normalized)) {
      continue;
    }
    const kind = isTextFile(normalized) ? "text" : "binary";
    if (kind === "text") {
      const content = await entry.async("string");
      const cleaned = stripLeadingSlashUrls(content);
      setFile({ path: normalized, kind: "text", data: cleaned, mime: fileMime(normalized) });
    } else {
      const buffer = await entry.async("arraybuffer");
      setFile({ path: normalized, kind: "binary", data: buffer, mime: fileMime(normalized) });
    }
  }
}

async function loadStarterTemplate() {
  try {
    const response = await fetch(STARTER_TEMPLATE_ZIP, { cache: "no-store" });
    if (!response.ok) return false;
    const JSZip = await ensureJSZip();
    const blob = await response.blob();
    const zip = await JSZip.loadAsync(blob);
    await applyZipContents(zip);
    await dbSet(state.projectId, serializeProject());
    return true;
  } catch (error) {
    console.warn("Failed to load starter template.", error);
    return false;
  }
}

async function importTgz(file) {
  try {
    await ensurePako();
    await ensureUntarSync();
    state.files = new Map();
    state.editorDocs = new Map();
    const buffer = await file.arrayBuffer();
    let tarBuffer = buffer;
    try {
      const inflated = window.pako.ungzip(new Uint8Array(buffer));
      tarBuffer = inflated.buffer;
    } catch (error) {
      // If it's already a plain tar, pako will fail; fall back to raw buffer.
    }
    const files = window.untar(tarBuffer);
    const fileEntries = [];
    for (const entry of files) {
      const rawName = entry.name || entry.filename || "";
      const entryType = entry.type;
      if (!rawName || entryType === "directory" || entryType === 5 || entryType === "5") continue;
      const normalized = normalizePath(rawName);
      if (!normalized || isHiddenPath(normalized)) continue;
      fileEntries.push({ entry, path: normalized });
    }
    const paths = fileEntries.map(({ path }) => path);
    const rootPrefix = computeImportRootPrefix(paths);
    const dirSet = computeDirSet(paths);
    for (const item of fileEntries) {
      const normalized = rootPrefix && item.path.startsWith(rootPrefix)
        ? item.path.slice(rootPrefix.length)
        : item.path;
      if (!normalized || isHiddenPath(normalized) || dirSet.has(normalized)) {
        continue;
      }
      const kind = isTextFile(normalized) ? "text" : "binary";
      const data = item.entry.buffer || item.entry.data || item.entry;
      if (kind === "text") {
        const text = new TextDecoder().decode(data);
        const cleaned = stripLeadingSlashUrls(text);
        setFile({ path: normalized, kind: "text", data: cleaned, mime: fileMime(normalized) });
      } else {
        const arrayBuffer = data instanceof ArrayBuffer ? data : data.buffer;
        setFile({ path: normalized, kind: "binary", data: arrayBuffer, mime: fileMime(normalized) });
      }
    }
    renderFileTree();
    openFirstFile();
    queueSave();
    queuePreview();
  } catch (error) {
    console.error(error);
    await showAlert("Import failed. Check the console for details.", "Import");
  }
}

async function buildZipBlob() {
  const JSZip = await ensureJSZip();
  const zip = new JSZip();
  for (const file of state.files.values()) {
    if (file.path.endsWith("/.keep")) {
      continue;
    }
    if (file.kind === "binary") {
      zip.file(file.path, file.data);
    } else {
      zip.file(file.path, file.data);
    }
  }
  return zip.generateAsync({ type: "blob" });
}

async function exportZip() {
  try {
    const blob = await buildZipBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `project-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    await showAlert("Export failed. Check the console for details.", "Export");
  }
}

async function publishProject() {
  try {
    if (!state.authUser) {
      openAccountModal();
      await showAlert(PUBLISH_LOCKED_LABEL, "Publish");
      return;
    }
    const hasMeta = await ensurePublishMetadata();
    if (!hasMeta) return;
    setStatus("Publishing...", 0);
    if (!state.csrfToken) {
      await fetchSession();
    }
    const blob = await buildZipBlob();
    const form = new FormData();
    form.append("zip", blob, `project-${Date.now()}.zip`);
    form.append("name", state.projectName);
    form.append("creator", state.projectCreator);
    form.append("description", state.projectDescription);
    form.append("csrf_token", state.csrfToken);
    const response = await fetch(PUBLISH_ENDPOINT, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const raw = await response.text();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await fetchSession();
        openAccountModal();
      }
      throw new Error(raw || `Publish failed (${response.status})`);
    }
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error(`Publish failed: ${raw.slice(0, 300)}`);
    }
    if (data?.url) {
      setStatus("Published");
      openPublishModal(data.url);
    } else {
      setStatus("Published");
      await showAlert("Published! Check the projects directory for your site.", "Publish");
    }
  } catch (error) {
    console.error(error);
    setStatus("Publish failed", 2000);
    await showAlert("Publish failed. Check the console for details.", "Publish");
  }
}
