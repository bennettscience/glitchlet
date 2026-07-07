// Glitchlet — Path and filename utilities.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

function normalizePath(path) {
  const normalized = path.replace(/\\/g, "/");
  const parts = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function isHiddenPath(path) {
  return path.split("/").some((segment) => segment && segment.startsWith("."));
}

function dirname(path) {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function resolvePath(baseDir, relPath) {
  if (relPath.startsWith("/")) return relPath;
  if (!baseDir) return normalizePath(relPath);
  return normalizePath(`${baseDir}/${relPath}`);
}

function extname(path) {
  const parts = path.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function isTextFile(path) {
  return TEXT_EXTS.has(extname(path));
}

function fileMime(path) {
  return MIME_BY_EXT[extname(path)] || "application/octet-stream";
}

function isFolderEntry(path) {
  return path.endsWith("/.keep");
}

function folderFromEntry(path) {
  return path.replace(/\/\.keep$/, "");
}

function isDescendantPath(path, candidateParent) {
  if (!path || !candidateParent) return false;
  return path === candidateParent || path.startsWith(`${candidateParent}/`);
}

function basename(path) {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}
