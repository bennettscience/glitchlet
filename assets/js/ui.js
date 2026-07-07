// Glitchlet — Layout, status bar, panel resize, and misc modals.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

function setStatus(text, hold = 1200) {
  elements.saveStatus.textContent = text;
  if (hold) {
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      elements.saveStatus.textContent = "";
    }, hold);
  }
}

function setFilePanelCollapsed(collapsed) {
  elements.workspace.classList.toggle("file-collapsed", collapsed);
  elements.expandFilePanelBtn.classList.toggle("hidden", !collapsed);
  elements.toggleFilePanelBtn.title = collapsed ? "Show files" : "Collapse files";
  const icon = collapsed ? "chevrons-right" : "chevrons-left";
  elements.toggleFilePanelBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  refreshIcons();
  if (collapsed) {
    elements.expandFilePanelBtn.classList.add("pulse");
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      elements.expandFilePanelBtn.classList.remove("pulse");
    }, 3200);
  }
  localStorage.setItem("stitch:file-panel-collapsed", collapsed ? "1" : "0");
}

function applyStoredLayout() {
  const collapsed = localStorage.getItem("stitch:file-panel-collapsed") === "1";
  setFilePanelCollapsed(collapsed);
  const storedWidth = Number(localStorage.getItem("stitch:editor-width"));
  if (storedWidth) {
    elements.editorPanel.style.flex = `0 0 ${storedWidth}px`;
  }
}

function openAboutModal() {
  if (elements.aboutVersion) {
    elements.aboutVersion.textContent = APP_VERSION;
  }
  elements.aboutModal.classList.remove("hidden");
  refreshIcons();
}

function closeAboutModal() {
  elements.aboutModal.classList.add("hidden");
}

function startResize(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  state.isResizing = true;
  document.body.classList.add("resizing");
  const startX = event.clientX;
  const startWidth = elements.editorPanel.getBoundingClientRect().width;
  const splitterWidth = elements.splitter.getBoundingClientRect().width;
  elements.previewFrame.style.pointerEvents = "none";
  elements.splitter.setPointerCapture(event.pointerId);

  const onMove = (moveEvent) => {
    if (!state.isResizing) return;
    const delta = moveEvent.clientX - startX;
    const workspaceWidth = elements.workspace.getBoundingClientRect().width;
    const fileWidth = elements.workspace.classList.contains("file-collapsed")
      ? 0
      : elements.filePanel.getBoundingClientRect().width;
    const availableWidth = workspaceWidth - fileWidth - splitterWidth;
    const minEditor = 240;
    const minPreview = 220;
    const maxEditor = Math.max(minEditor, availableWidth - minPreview);
    const nextWidth = Math.max(minEditor, Math.min(maxEditor, startWidth + delta));
    const previewWidth = Math.max(minPreview, availableWidth - nextWidth);
    elements.editorPanel.style.flex = `0 0 ${nextWidth}px`;
    elements.previewPanel.style.flex = `1 1 ${previewWidth}px`;
  };

  const stopResize = () => {
    if (!state.isResizing) return;
    state.isResizing = false;
    document.body.classList.remove("resizing");
    elements.previewFrame.style.pointerEvents = "";
    const finalWidth = elements.editorPanel.getBoundingClientRect().width;
    localStorage.setItem("stitch:editor-width", Math.round(finalWidth).toString());
    elements.splitter.removeEventListener("pointermove", onMove);
    elements.splitter.removeEventListener("pointerup", stopResize);
    elements.splitter.removeEventListener("pointercancel", stopResize);
    elements.splitter.removeEventListener("lostpointercapture", stopResize);
  };

  elements.splitter.addEventListener("pointermove", onMove);
  elements.splitter.addEventListener("pointerup", stopResize);
  elements.splitter.addEventListener("pointercancel", stopResize);
  elements.splitter.addEventListener("lostpointercapture", stopResize);
}
