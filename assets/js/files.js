// Glitchlet — In-memory file model and file tree rendering.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

function getFile(path) {
  return state.files.get(path) || null;
}

function setFile(file) {
  state.files.set(file.path, file);
}

function renameFile(oldPath, newPath) {
  const normalized = normalizePath(newPath);
  if (!normalized) {
    return { ok: false, error: "Please enter a valid file name." };
  }
  if (normalized === oldPath) return { ok: false, error: "" };
  if (state.files.has(normalized)) {
    return { ok: false, error: "A file with that name already exists." };
  }
  const file = getFile(oldPath);
  if (!file) return { ok: false, error: "File not found." };
  state.files.delete(oldPath);
  file.path = normalized;
  file.mime = fileMime(normalized);
  state.files.set(normalized, file);
  const doc = state.editorDocs.get(oldPath);
  if (doc) {
    state.editorDocs.delete(oldPath);
    state.editorDocs.set(normalized, doc);
  }
  if (state.currentPath === oldPath) {
    state.currentPath = normalized;
    elements.currentFileLabel.textContent = normalized;
    setEditorMode(normalized);
  }
  return { ok: true };
}

function renameFolder(oldPath, newPath) {
  const normalized = normalizePath(newPath).replace(/\/$/, "");
  if (!normalized) {
    return { ok: false, error: "Please enter a valid folder name." };
  }
  if (normalized === oldPath) return { ok: false, error: "" };
  if (normalized.startsWith(`${oldPath}/`)) {
    return { ok: false, error: "Folders cannot be moved inside themselves." };
  }
  const targetPrefix = `${oldPath}/`;
  const toRename = Array.from(state.files.keys()).filter((path) => {
    return path === `${oldPath}/.keep` || path.startsWith(targetPrefix);
  });
  if (!toRename.length) {
    return { ok: false, error: "Folder not found." };
  }
  const renameSet = new Set(toRename);
  for (const path of toRename) {
    const nextPath = path === `${oldPath}/.keep`
      ? `${normalized}/.keep`
      : `${normalized}${path.slice(oldPath.length)}`;
    if (state.files.has(nextPath) && !renameSet.has(nextPath)) {
      return { ok: false, error: "A file or folder with that name already exists." };
    }
  }
  for (const path of toRename) {
    const nextPath = path === `${oldPath}/.keep`
      ? `${normalized}/.keep`
      : `${normalized}${path.slice(oldPath.length)}`;
    const file = getFile(path);
    if (!file) continue;
    state.files.delete(path);
    file.path = nextPath;
    file.mime = fileMime(nextPath);
    state.files.set(nextPath, file);
    const doc = state.editorDocs.get(path);
    if (doc) {
      state.editorDocs.delete(path);
      state.editorDocs.set(nextPath, doc);
    }
    if (state.currentPath === path) {
      state.currentPath = nextPath;
      elements.currentFileLabel.textContent = nextPath;
      setEditorMode(nextPath);
    }
  }
  return { ok: true };
}

function removeFile(path) {
  state.files.delete(path);
  state.editorDocs.delete(path);
  if (state.currentPath === path) {
    state.currentPath = null;
    setEditorValue("");
    elements.currentFileLabel.textContent = "Select a file";
  }
}

function removeFolder(folderPath) {
  const prefix = `${folderPath}/`;
  for (const path of Array.from(state.files.keys())) {
    if (path === folderPath || path.startsWith(prefix)) {
      state.files.delete(path);
      state.editorDocs.delete(path);
      if (state.currentPath === path) {
        state.currentPath = null;
        setEditorValue("");
        elements.currentFileLabel.textContent = "Select a file";
      }
    }
  }
}

function renderFileTree() {
  elements.fileTree.innerHTML = "";
  const tree = buildFileTree(Array.from(state.files.keys()));

  const renderNode = (node, depth) => {
    const item = document.createElement("div");
    item.className = "file-item";
    item.style.paddingLeft = `${10 + depth * 14}px`;
    if (node.type === "folder") {
      item.classList.add("file-folder");
      if (node.path === state.currentFolderPath) {
        item.classList.add("folder-active");
      }
    } else if (node.path === state.currentPath) {
      item.classList.add("active");
    }

    const label = document.createElement("span");
    label.textContent = node.type === "folder" ? `${node.name}/` : node.name;

    const actions = document.createElement("div");
    actions.className = "file-item-actions";

    if (node.type === "folder") {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "icon-btn";
      const collapsed = state.collapsedFolders.has(node.path);
      toggleBtn.innerHTML = `<i data-lucide="${collapsed ? "chevron-right" : "chevron-down"}"></i>`;
      toggleBtn.title = collapsed ? "Expand folder" : "Collapse folder";
      toggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.collapsedFolders.has(node.path)) {
          state.collapsedFolders.delete(node.path);
        } else {
          state.collapsedFolders.add(node.path);
        }
        renderFileTree();
      });

      const renameFolderBtn = document.createElement("button");
      renameFolderBtn.className = "icon-btn";
      renameFolderBtn.innerHTML = "<i data-lucide=\"pencil\"></i>";
      renameFolderBtn.title = "Rename folder";
      renameFolderBtn.dataset.tutorialTitle = "Rename folder";
      renameFolderBtn.dataset.tutorial = "Rename this folder and everything inside it.";
      bindTutorialTarget(renameFolderBtn);
      renameFolderBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const next = await showPrompt("Rename folder:", node.path, "Rename folder");
        if (!next) return;
        const result = renameFolder(node.path, next);
        if (!result.ok) {
          if (result.error) await showAlert(result.error, "Rename failed");
          return;
        }
        renderFileTree();
        queueSave();
        queuePreview();
      });

      const removeFolderBtn = document.createElement("button");
      removeFolderBtn.className = "icon-btn";
      removeFolderBtn.innerHTML = "<i data-lucide=\"trash-2\"></i>";
      removeFolderBtn.title = "Delete folder";
      removeFolderBtn.dataset.tutorialTitle = "Delete folder";
      removeFolderBtn.dataset.tutorial = "Delete the folder and all of its files.";
      bindTutorialTarget(removeFolderBtn);
      removeFolderBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const confirmed = await showConfirm(
          `Delete folder ${node.path} and all its files?`,
          "Delete folder"
        );
        if (!confirmed) return;
        removeFolder(node.path);
        renderFileTree();
        queueSave();
        queuePreview();
      });

      actions.append(toggleBtn, renameFolderBtn, removeFolderBtn);

      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        item.classList.add("drag-over");
        event.dataTransfer.dropEffect = "move";
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });
      item.addEventListener("drop", async (event) => {
        event.preventDefault();
        item.classList.remove("drag-over");
        const draggedPath = event.dataTransfer.getData("text/plain");
        if (!draggedPath) return;
        if (isFolderEntry(draggedPath)) {
          const folderPath = folderFromEntry(draggedPath);
          const targetPath = `${node.path}/${basename(folderPath)}`;
          if (isDescendantPath(targetPath, folderPath)) {
            await showAlert("You can't move a folder into itself.", "Move folder");
            return;
          }
          const result = renameFolder(folderPath, targetPath);
          if (!result.ok) {
            if (result.error) await showAlert(result.error, "Move folder");
            return;
          }
          renderFileTree();
          queueSave();
          queuePreview();
          return;
        }
        const targetPath = `${node.path}/${basename(draggedPath)}`;
        const result = renameFile(draggedPath, targetPath);
        if (!result.ok) {
          if (result.error) await showAlert(result.error, "Move file");
          return;
        }
        renderFileTree();
        queueSave();
        queuePreview();
      });
      item.setAttribute("draggable", "true");
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${node.path}/.keep`);
      });
      item.addEventListener("click", () => {
        state.currentFolderPath = node.path;
      });
    } else {
      const renameBtn = document.createElement("button");
      renameBtn.className = "icon-btn";
      renameBtn.innerHTML = "<i data-lucide=\"pencil\"></i>";
      renameBtn.title = "Rename file";
      renameBtn.dataset.tutorialTitle = "Rename file";
      renameBtn.dataset.tutorial = "Rename this file without changing its contents.";
      bindTutorialTarget(renameBtn);
      renameBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const next = await showPrompt("Rename file:", node.path, "Rename file");
        if (!next) return;
        const result = renameFile(node.path, next);
        if (!result.ok) {
          if (result.error) await showAlert(result.error, "Rename failed");
          return;
        }
        renderFileTree();
        queueSave();
        queuePreview();
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = "<i data-lucide=\"trash-2\"></i>";
      removeBtn.title = "Delete file";
      removeBtn.dataset.tutorialTitle = "Delete file";
      removeBtn.dataset.tutorial = "Remove this file from the project.";
      bindTutorialTarget(removeBtn);
      removeBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const confirmed = await showConfirm(`Delete ${node.path}?`, "Delete file");
        if (!confirmed) return;
        removeFile(node.path);
        renderFileTree();
        queueSave();
        queuePreview();
      });

      actions.append(renameBtn, removeBtn);
      item.setAttribute("draggable", "true");
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.path);
      });
      item.addEventListener("click", () => openFile(node.path));
    }

    item.append(label, actions);
    elements.fileTree.appendChild(item);

    if (node.type === "folder" && !state.collapsedFolders.has(node.path)) {
      sortNodes(node).forEach((child) => renderNode(child, depth + 1));
    }
  };

  sortNodes(tree).forEach((child) => renderNode(child, 0));
  refreshIcons();
}

function openFile(path) {
  const file = getFile(path);
  if (!file) return;
  state.currentPath = path;
  state.currentFolderPath = dirname(path);
  elements.currentFileLabel.textContent = path;
  renderFileTree();

  if (file.kind === "binary") {
    elements.binaryNotice.classList.remove("hidden");
    setEditorReadOnly(true);
    if (codeMirror) {
      if (!state.binaryDoc) {
        state.binaryDoc = new CodeMirror.Doc("", null);
      }
      codeMirror.swapDoc(state.binaryDoc);
    } else {
      setEditorValue("");
    }
    return;
  }

  elements.binaryNotice.classList.add("hidden");
  setEditorReadOnly(false);

  if (codeMirror) {
    let doc = state.editorDocs.get(path);
    if (!doc) {
      doc = new CodeMirror.Doc(file.data, getEditorMode(path));
      state.editorDocs.set(path, doc);
    }
    codeMirror.swapDoc(doc);
    setEditorMode(path);
    return;
  }

  setEditorMode(path);
  setEditorValue(file.data);
}

function updateCurrentFile(value) {
  const path = state.currentPath;
  if (!path) return;
  const file = getFile(path);
  if (!file || file.kind === "binary") return;
  file.data = value;
  setFile(file);
}

function openFirstFile() {
  if (getFile("index.html")) {
    openFile("index.html");
    return;
  }
  const first = Array.from(state.files.keys()).sort()[0];
  if (first) {
    openFile(first);
    return;
  }
  state.currentPath = null;
  elements.currentFileLabel.textContent = "Select a file";
  elements.binaryNotice.classList.add("hidden");
  setEditorReadOnly(false);
  if (codeMirror) {
    if (!state.emptyDoc) {
      state.emptyDoc = new CodeMirror.Doc("", null);
    }
    codeMirror.swapDoc(state.emptyDoc);
  } else {
    setEditorValue("");
  }
}

function addFile(path, data = "", kind = null) {
  const normalized = normalizePath(path);
  if (!normalized) return;
  const fileKind = kind || (isTextFile(normalized) ? "text" : "binary");
  const payload = fileKind === "binary" ? (data instanceof ArrayBuffer ? data : new ArrayBuffer(0)) : String(data);
  const file = {
    path: normalized,
    kind: fileKind,
    data: payload,
    mime: fileMime(normalized),
  };
  setFile(file);
  renderFileTree();
  queueSave();
  queuePreview();
}

function addFolder(path) {
  const normalized = normalizePath(path).replace(/\/$/, "");
  if (!normalized) return false;
  const marker = `${normalized}/.keep`;
  if (state.files.has(marker)) return false;
  addFile(marker, "", "text");
  return true;
}

function buildFileTree(paths) {
  const root = { name: "", path: "", type: "folder", children: new Map() };
  for (const path of paths) {
    if (isFolderEntry(path)) {
      const folderPath = folderFromEntry(path);
      const segments = folderPath.split("/");
      let node = root;
      let currentPath = "";
      for (const segment of segments) {
        if (!segment) continue;
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        if (!node.children.has(segment)) {
          node.children.set(segment, { name: segment, path: currentPath, type: "folder", children: new Map() });
        }
        node = node.children.get(segment);
      }
      continue;
    }
    const segments = path.split("/");
    let node = root;
    let currentPath = "";
    segments.forEach((segment, index) => {
      if (!segment) return;
      const isLeaf = index === segments.length - 1;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (isLeaf) {
        node.children.set(segment, { name: segment, path: currentPath, type: "file" });
      } else {
        if (!node.children.has(segment)) {
          node.children.set(segment, { name: segment, path: currentPath, type: "folder", children: new Map() });
        }
        node = node.children.get(segment);
      }
    });
  }
  return root;
}

function sortNodes(node) {
  const folders = [];
  const files = [];
  node.children.forEach((child) => {
    if (child.type === "folder") folders.push(child);
    else files.push(child);
  });
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...folders, ...files];
}

async function handleFileUpload(files) {
  for (const file of files) {
    const path = normalizePath(file.name);
    const kind = isTextFile(path) ? "text" : "binary";
    if (kind === "text") {
      const text = await file.text();
      addFile(path, text, "text");
    } else {
      const buffer = await file.arrayBuffer();
      addFile(path, buffer, "binary");
    }
  }
}
