const DB_NAME = "glitchlite-db";
const STORE_NAME = "projects";
const DEFAULT_PROJECT_ID = "default";
const PUBLISH_ENDPOINT = new URL("/publish/publish.php", window.location.origin).toString();
const APP_VERSION = window.GLITCHLET_VERSION || "dev";
const STARTER_TEMPLATE_ZIP = "starter_template.zip";
const PUBLISH_LOCKED_LABEL =
  "Publishing is only for logged in users. Contact your Glitchlet admin to create an account.";
const THEME_STORAGE_KEY = "stitch:theme";
const EDITOR_THEME_KEY = "stitch:editor-theme";
const LINE_WRAP_KEY = "stitch:line-wrap";
const TUTORIAL_STORAGE_KEY = "stitch:tutorial-mode";
const CURRENT_PROJECT_KEY = "stitch:current-project";
const DEFAULT_PROJECT_NAME = "Untitled Project";
const TEXT_EXTS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "json",
  "txt",
  "md",
  "svg",
  "csv",
]);
const MIME_BY_EXT = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
};

const state = {
  projectId: DEFAULT_PROJECT_ID,
  projectName: DEFAULT_PROJECT_NAME,
  projectDescription: "",
  projectCreator: "",
  files: new Map(),
  editorDocs: new Map(),
  binaryDoc: null,
  emptyDoc: null,
  currentPath: null,
  currentFolderPath: "",
  collapsedFolders: new Set(),
  saveTimer: null,
  previewTimer: null,
  statusTimer: null,
  suppressEditorChange: false,
  isResizing: false,
  authUser: null,
  csrfToken: "",
  tutorialMode: false,
};

const elements = {
  workspace: document.getElementById("workspace"),
  fileTree: document.getElementById("fileTree"),
  editor: document.getElementById("editor"),
  editorPanel: document.querySelector(".editor-panel"),
  previewPanel: document.querySelector(".preview-panel"),
  filePanel: document.querySelector(".file-panel"),
  splitter: document.getElementById("editorPreviewSplitter"),
  currentFileLabel: document.getElementById("currentFileLabel"),
  binaryNotice: document.getElementById("binaryNotice"),
  saveStatus: document.getElementById("saveStatus"),
  previewFrame: document.getElementById("previewFrame"),
  previewWarnings: document.getElementById("previewWarnings"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  importZipBtn: document.getElementById("importZipBtn"),
  exportZipBtn: document.getElementById("exportZipBtn"),
  publishBtn: document.getElementById("publishBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  editorThemeToggleBtn: document.getElementById("editorThemeToggleBtn"),
  wrapToggleBtn: document.getElementById("wrapToggleBtn"),
  searchBtn: document.getElementById("searchBtn"),
  foldAllBtn: document.getElementById("foldAllBtn"),
  unfoldAllBtn: document.getElementById("unfoldAllBtn"),
  prettifyBtn: document.getElementById("prettifyBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  currentProjectName: document.getElementById("currentProjectName"),
  projectMetaBtn: document.getElementById("projectMetaBtn"),
  projectMetaModal: document.getElementById("projectMetaModal"),
  closeProjectMetaBtn: document.getElementById("closeProjectMetaBtn"),
  saveProjectMetaBtn: document.getElementById("saveProjectMetaBtn"),
  projectTitleInput: document.getElementById("projectTitleInput"),
  projectCreatorInput: document.getElementById("projectCreatorInput"),
  projectDescriptionInput: document.getElementById("projectDescriptionInput"),
  newProjectModal: document.getElementById("newProjectModal"),
  closeNewProjectBtn: document.getElementById("closeNewProjectBtn"),
  newProjectNameInput: document.getElementById("newProjectNameInput"),
  includeStarterFilesInput: document.getElementById("includeStarterFilesInput"),
  createProjectBtn: document.getElementById("createProjectBtn"),
  publishModal: document.getElementById("publishModal"),
  closePublishModalBtn: document.getElementById("closePublishModalBtn"),
  publishUrlText: document.getElementById("publishUrlText"),
  publishPasswordBlock: document.getElementById("publishPasswordBlock"),
  publishPasswordText: document.getElementById("publishPasswordText"),
  copyPublishPasswordBtn: document.getElementById("copyPublishPasswordBtn"),
  copyPublishUrlBtn: document.getElementById("copyPublishUrlBtn"),
  openPublishUrlBtn: document.getElementById("openPublishUrlBtn"),
  aboutBtn: document.getElementById("aboutBtn"),
  aboutModal: document.getElementById("aboutModal"),
  aboutVersion: document.getElementById("aboutVersion"),
  closeAboutBtn: document.getElementById("closeAboutBtn"),
  dismissAboutBtn: document.getElementById("dismissAboutBtn"),
  tutorialToggleBtn: document.getElementById("tutorialToggleBtn"),
  accountBtn: document.getElementById("accountBtn"),
  accountModal: document.getElementById("accountModal"),
  closeAccountModalBtn: document.getElementById("closeAccountModalBtn"),
  loginPanel: document.getElementById("loginPanel"),
  loginEmailInput: document.getElementById("loginEmailInput"),
  loginPasswordInput: document.getElementById("loginPasswordInput"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  loginError: document.getElementById("loginError"),
  loginActions: document.getElementById("loginActions"),
  accountPanel: document.getElementById("accountPanel"),
  accountSummary: document.getElementById("accountSummary"),
  accountProjectsLink: document.getElementById("accountProjectsLink"),
  accountManagerLink: document.getElementById("accountManagerLink"),
  logoutBtn: document.getElementById("logoutBtn"),
  dialogModal: document.getElementById("dialogModal"),
  dialogCloseBtn: document.getElementById("dialogCloseBtn"),
  dialogTitle: document.getElementById("dialogTitle"),
  dialogMessage: document.getElementById("dialogMessage"),
  dialogInput: document.getElementById("dialogInput"),
  dialogCancelBtn: document.getElementById("dialogCancelBtn"),
  dialogOkBtn: document.getElementById("dialogOkBtn"),
  projectManagerBtn: document.getElementById("projectManagerBtn"),
  projectManagerPanel: document.getElementById("projectManagerPanel"),
  closeProjectManagerBtn: document.getElementById("closeProjectManagerBtn"),
  projectNameInput: document.getElementById("projectNameInput"),
  renameProjectBtn: document.getElementById("renameProjectBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  saveProjectAsBtn: document.getElementById("saveProjectAsBtn"),
  projectList: document.getElementById("projectList"),
  addFileBtn: document.getElementById("addFileBtn"),
  addFolderBtn: document.getElementById("addFolderBtn"),
  uploadFileBtn: document.getElementById("uploadFileBtn"),
  refreshPreviewBtn: document.getElementById("refreshPreviewBtn"),
  zipInput: document.getElementById("zipInput"),
  fileInput: document.getElementById("fileInput"),
  toggleFilePanelBtn: document.getElementById("toggleFilePanelBtn"),
  expandFilePanelBtn: document.getElementById("expandFilePanelBtn"),
};

let codeMirror = null;
let lineWrappingEnabled = false;
let dialogResolver = null;
let dialogMode = "alert";
let tutorialTooltip = null;
let tutorialTarget = null;

function openDialog(options = {}) {
  const {
    title = "Notice",
    message = "",
    mode = "alert",
    defaultValue = "",
    okLabel = "OK",
    cancelLabel = "Cancel",
  } = options;
  dialogMode = mode;
  elements.dialogTitle.textContent = title;
  elements.dialogMessage.textContent = message;
  elements.dialogOkBtn.textContent = okLabel;
  elements.dialogCancelBtn.textContent = cancelLabel;
  if (mode === "prompt") {
    elements.dialogInput.classList.remove("hidden");
    elements.dialogInput.value = defaultValue;
  } else {
    elements.dialogInput.classList.add("hidden");
    elements.dialogInput.value = "";
  }
  elements.dialogCancelBtn.classList.toggle("hidden", mode === "alert");
  elements.dialogModal.classList.remove("hidden");
  refreshIcons();
  if (mode === "prompt") {
    elements.dialogInput.focus();
  } else {
    elements.dialogOkBtn.focus();
  }
  return new Promise((resolve) => {
    dialogResolver = resolve;
  });
}

function closeDialog(result) {
  elements.dialogModal.classList.add("hidden");
  const resolve = dialogResolver;
  dialogResolver = null;
  if (resolve) {
    resolve(result);
  }
}

function showAlert(message, title = "Notice") {
  return openDialog({ title, message, mode: "alert", okLabel: "OK" });
}

function showConfirm(message, title = "Confirm") {
  return openDialog({ title, message, mode: "confirm", okLabel: "OK", cancelLabel: "Cancel" });
}

function showPrompt(message, defaultValue = "", title = "Input") {
  return openDialog({ title, message, mode: "prompt", defaultValue, okLabel: "OK", cancelLabel: "Cancel" });
}

function dialogCancelResult() {
  if (dialogMode === "prompt") return null;
  if (dialogMode === "confirm") return false;
  return true;
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function setAuthUser(user) {
  state.authUser = user;
  updateAuthUI();
}

function updateAuthUI() {
  const user = state.authUser;
  const isAuthed = Boolean(user);
  if (elements.accountBtn) {
    if (!isAuthed) {
      elements.accountBtn.textContent = "Guest";
    } else if (user.role === "manager") {
      elements.accountBtn.textContent = "Admin";
    } else {
      elements.accountBtn.textContent = "Editor";
    }
  }

  if (elements.publishBtn) {
    elements.publishBtn.classList.remove("btn-disabled");
    elements.publishBtn.disabled = false;
    elements.publishBtn.textContent = "Publish";
    elements.publishBtn.title = "Publish";
    elements.publishBtn.setAttribute("aria-disabled", "false");
  }

  if (elements.loginPanel && elements.accountPanel) {
    elements.loginPanel.classList.toggle("hidden", isAuthed);
    elements.accountPanel.classList.toggle("hidden", !isAuthed);
  }
  if (elements.loginActions) {
    elements.loginActions.classList.toggle("hidden", isAuthed);
  }
  if (elements.accountSummary && user) {
    elements.accountSummary.textContent = `${user.email} (${user.role})`;
  }
  if (elements.accountManagerLink) {
    elements.accountManagerLink.classList.toggle("hidden", !user || user.role !== "manager");
  }
}

async function fetchSession() {
  try {
    const response = await fetch("/publish/session.php", { credentials: "include" });
    const data = await response.json();
    if (data?.csrf) {
      state.csrfToken = data.csrf;
    }
    setAuthUser(data?.user || null);
  } catch (error) {
    console.error(error);
    setAuthUser(null);
  }
}

function openAccountModal() {
  if (!elements.accountModal) return;
  updateAuthUI();
  if (elements.loginError) elements.loginError.textContent = "";
  elements.accountModal.classList.remove("hidden");
  refreshIcons();
  if (!state.authUser && elements.loginEmailInput) {
    elements.loginEmailInput.focus();
  }
}

function closeAccountModal() {
  if (!elements.accountModal) return;
  elements.accountModal.classList.add("hidden");
}

async function handleLoginSubmit() {
  if (!elements.loginEmailInput || !elements.loginPasswordInput) return;
  const email = elements.loginEmailInput.value.trim();
  const password = elements.loginPasswordInput.value;
  if (!email || !password) {
    if (elements.loginError) {
      elements.loginError.textContent = "Email and password required.";
    }
    return;
  }
  if (elements.loginSubmitBtn) {
    elements.loginSubmitBtn.disabled = true;
  }
  try {
    if (!state.csrfToken) {
      await fetchSession();
    }
    const response = await fetch("/publish/login.php", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": state.csrfToken,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Login failed.");
    }
    if (data?.csrf) {
      state.csrfToken = data.csrf;
    }
    setAuthUser(data.user || null);
    elements.loginPasswordInput.value = "";
    closeAccountModal();
    if (codeMirror) {
      codeMirror.focus();
    } else if (elements.editor) {
      elements.editor.focus();
    }
  } catch (error) {
    console.error(error);
    if (elements.loginError) {
      elements.loginError.textContent = "Login failed. Check your email or password.";
    }
  } finally {
    if (elements.loginSubmitBtn) {
      elements.loginSubmitBtn.disabled = false;
    }
  }
}

async function handleLogout() {
  try {
    await fetch("/publish/logout.php", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": state.csrfToken },
    });
  } catch (error) {
    console.error(error);
  } finally {
    setAuthUser(null);
  }
}

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

function createDefaultFiles() {
  return [
    {
      path: "index.html",
      kind: "text",
      data: `<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>My Project</title>\n    <link rel=\"stylesheet\" href=\"style.css\" />\n  </head>\n  <body>\n    <main class=\"stage\">\n      <h1>Make something</h1>\n      <p>Start editing the files on the left.</p>\n      <button id=\"btn\">Click me</button>\n    </main>\n    <script src=\"script.js\"></script>\n  </body>\n</html>\n`,
      mime: "text/html",
    },
    {
      path: "style.css",
      kind: "text",
      data: `:root {\n  color-scheme: light;\n  font-family: \"Trebuchet MS\", sans-serif;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: linear-gradient(135deg, #f7f2ea, #fde6c8);\n}\n\n.stage {\n  text-align: center;\n  padding: 48px;\n  background: white;\n  border-radius: 24px;\n  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);\n}\n\nbutton {\n  margin-top: 20px;\n  border: none;\n  background: #d65a31;\n  color: white;\n  padding: 12px 18px;\n  border-radius: 999px;\n  font-weight: 600;\n}\n`,
      mime: "text/css",
    },
    {
      path: "script.js",
      kind: "text",
      data: `const btn = document.getElementById("btn");\n\nbtn?.addEventListener("click", () => {\n  btn.textContent = "Nice!";\n});\n`,
      mime: "text/javascript",
    },
  ];
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const keysRequest = store.getAllKeys();
    const valuesRequest = store.getAll();
    tx.oncomplete = () => {
      const keys = keysRequest.result || [];
      const values = valuesRequest.result || [];
      resolve(keys.map((key, index) => ({ id: String(key), data: values[index] || null })));
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getStoredProjectId() {
  try {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || DEFAULT_PROJECT_ID;
  } catch (error) {
    console.warn("Unable to access localStorage", error);
    return DEFAULT_PROJECT_ID;
  }
}

function normalizeProjectName(name) {
  const trimmed = String(name || "").trim();
  return trimmed || DEFAULT_PROJECT_NAME;
}

function createProjectId() {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function setStatus(text, hold = 1200) {
  elements.saveStatus.textContent = text;
  if (hold) {
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      elements.saveStatus.textContent = "";
    }, hold);
  }
}

function getEditorValue() {
  return codeMirror ? codeMirror.getValue() : elements.editor.value;
}

function setEditorValue(value) {
  if (codeMirror) {
    state.suppressEditorChange = true;
    codeMirror.setValue(value);
    state.suppressEditorChange = false;
  } else {
    elements.editor.value = value;
  }
}

function setEditorReadOnly(isReadOnly) {
  if (codeMirror) {
    codeMirror.setOption("readOnly", isReadOnly ? "nocursor" : false);
  } else {
    elements.editor.disabled = isReadOnly;
  }
}

function setEditorMode(path) {
  if (!codeMirror) return;
  const mode = getEditorMode(path);
  codeMirror.setOption("mode", mode);
}

function getEditorMode(path) {
  const ext = extname(path);
  if (ext === "html" || ext === "htm") return "htmlmixed";
  if (ext === "css") return "css";
  if (ext === "js") return "javascript";
  return "text/plain";
}

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

async function prettifyCurrentFile() {
  const path = state.currentPath;
  if (!path) {
    await showAlert("Pick a file to format.", "Prettify");
    return;
  }
  const file = getFile(path);
  if (!file || file.kind === "binary") {
    await showAlert("This file type cannot be prettified.", "Prettify");
    return;
  }
  if (!window.prettier || !window.prettierPlugins) {
    await showAlert("Prettier is still loading. Try again in a moment.", "Prettify");
    return;
  }
  const ext = extname(path);
  let parser = null;
  if (ext === "js") parser = "babel";
  if (ext === "css") parser = "css";
  if (ext === "html" || ext === "htm") parser = "html";
  if (!parser) {
    await showAlert("Prettify supports HTML, CSS, and JavaScript files.", "Prettify");
    return;
  }
  try {
    const formatted = await window.prettier.format(file.data, {
      parser,
      plugins: window.prettierPlugins,
      tabWidth: 2,
      printWidth: 80,
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
    });
    if (typeof formatted !== "string") {
      throw new Error("Prettier returned non-string output.");
    }
    setEditorValue(formatted);
    updateCurrentFile(formatted);
    queueSave();
    queuePreview();
  } catch (error) {
    console.error(error);
    await showAlert("Prettify failed. Check the console for details.", "Prettify");
  }
}

function serializeProject() {
  const files = Array.from(state.files.values()).map((file) => {
    const payload = {
      path: file.path,
      kind: file.kind,
      mime: file.mime,
    };
    if (file.kind === "binary") {
      payload.data = Array.from(new Uint8Array(file.data));
    } else {
      payload.data = file.data;
    }
    return payload;
  });
  return {
    id: state.projectId,
    name: state.projectName,
    description: state.projectDescription,
    creator: state.projectCreator,
    updatedAt: Date.now(),
    files,
  };
}

function loadProject(project) {
  state.files = new Map();
  state.editorDocs = new Map();
  state.projectName = normalizeProjectName(project?.name);
  state.projectDescription = String(project?.description || "");
  state.projectCreator = String(project?.creator || "");
  for (const file of project.files) {
    let data = file.data;
    if (file.kind === "binary") {
      data = new Uint8Array(file.data).buffer;
    }
    setFile({ path: file.path, kind: file.kind, mime: file.mime, data });
  }
}

function queueSave() {
  clearTimeout(state.saveTimer);
  setStatus("Saving...", 0);
  state.saveTimer = setTimeout(async () => {
    try {
      localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
      await dbSet(state.projectId, serializeProject());
      setStatus("Saved");
    } catch (error) {
      console.error(error);
      setStatus("Save failed", 2000);
    }
  }, 400);
}

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

async function loadInitialProject() {
  state.projectId = getStoredProjectId();
  const stored = await dbGet(state.projectId);
  if (stored && stored.files?.length) {
    loadProject(stored);
  } else {
    const loadedStarter = await loadStarterTemplate();
    if (!loadedStarter) {
      const defaults = createDefaultFiles();
      defaults.forEach((file) => setFile({ ...file }));
      await dbSet(state.projectId, serializeProject());
    }
  }

  renderFileTree();
  openFirstFile();
  renderPreview();
  renderProjectManager();
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

async function resetProject(options = {}) {
  const { name, includeStarter = true } = options;
  state.projectId = createProjectId();
  state.projectName = normalizeProjectName(name);
  state.projectDescription = "";
  state.projectCreator = "";
  localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
  state.files = new Map();
  state.editorDocs = new Map();
  if (includeStarter) {
    const defaults = createDefaultFiles();
    defaults.forEach((file) => setFile({ ...file }));
  }
  renderFileTree();
  openFirstFile();
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  queuePreview();
}

function isDarkTheme(theme) {
  if (theme && theme !== "auto") return theme === "dark";
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function updateThemeToggleLabel(theme) {
  if (!elements.themeToggleBtn) return;
  const mode = theme === "dark" ? "dark" : "light";
  const nextMode = mode === "dark" ? "light" : "dark";
  elements.themeToggleBtn.title = `Theme: ${mode[0].toUpperCase()}${mode.slice(1)} (switch to ${nextMode})`;
}

function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  updateThemeToggleLabel(resolved);
}

function toggleTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const current = stored === "dark" || stored === "light"
    ? stored
    : (isDarkTheme(null) ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

function resolveEditorTheme(theme) {
  if (theme === "dark" || theme === "light") return theme;
  return isDarkTheme(null) ? "dark" : "light";
}

function updateEditorThemeToggleLabel(theme) {
  if (!elements.editorThemeToggleBtn) return;
  const resolved = resolveEditorTheme(theme);
  const next = resolved === "dark" ? "light" : "dark";
  const icon = resolved === "dark" ? "moon-star" : "sun";
  elements.editorThemeToggleBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  elements.editorThemeToggleBtn.title = `Editor: ${resolved} (switch to ${next})`;
  refreshIcons();
}

function applyEditorTheme(theme) {
  const resolved = resolveEditorTheme(theme);
  document.documentElement.setAttribute("data-editor-theme", resolved);
  if (codeMirror) {
    codeMirror.setOption("theme", resolved === "dark" ? "material-darker" : "default");
  }
  updateEditorThemeToggleLabel(theme);
}

function toggleEditorTheme() {
  const stored = localStorage.getItem(EDITOR_THEME_KEY);
  const current = resolveEditorTheme(stored);
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(EDITOR_THEME_KEY, next);
  applyEditorTheme(next);
}

function setupEvents() {
  if (codeMirror) {
    codeMirror.on("change", () => {
      if (state.suppressEditorChange) return;
      updateCurrentFile(getEditorValue());
      queueSave();
      queuePreview();
    });
  } else {
    elements.editor.addEventListener("input", () => {
      updateCurrentFile(elements.editor.value);
      queueSave();
      queuePreview();
    });
  }

  elements.newProjectBtn.addEventListener("click", openNewProjectModal);
  elements.importZipBtn.addEventListener("click", () => elements.zipInput.click());
  elements.exportZipBtn.addEventListener("click", exportZip);
  elements.publishBtn.addEventListener("click", publishProject);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  if (elements.tutorialToggleBtn) {
    elements.tutorialToggleBtn.addEventListener("click", toggleTutorialMode);
  }
  elements.editorThemeToggleBtn.addEventListener("click", toggleEditorTheme);
  elements.wrapToggleBtn.addEventListener("click", toggleLineWrap);
  elements.searchBtn.addEventListener("click", async () => {
    if (!codeMirror) {
      await showAlert("Search is only available in the code editor.", "Search");
      return;
    }
    codeMirror.execCommand("find");
  });
  elements.foldAllBtn.addEventListener("click", async () => {
    if (!codeMirror) {
      await showAlert("Folding is only available in the code editor.", "Fold");
      return;
    }
    codeMirror.execCommand("foldAll");
  });
  elements.unfoldAllBtn.addEventListener("click", async () => {
    if (!codeMirror) {
      await showAlert("Folding is only available in the code editor.", "Unfold");
      return;
    }
    codeMirror.execCommand("unfoldAll");
  });
  elements.prettifyBtn.addEventListener("click", prettifyCurrentFile);
  elements.projectMetaBtn.addEventListener("click", openProjectMetaModal);
  elements.closeProjectMetaBtn.addEventListener("click", saveProjectMeta);
  elements.saveProjectMetaBtn.addEventListener("click", saveProjectMeta);
  elements.projectMetaModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      saveProjectMeta();
    }
  });
  elements.projectMetaModal.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveProjectMeta();
    }
  });
  elements.createProjectBtn.addEventListener("click", createNewProjectFromModal);
  elements.closeNewProjectBtn.addEventListener("click", closeNewProjectModal);
  elements.newProjectModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeNewProjectModal();
    }
  });
  elements.newProjectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      createNewProjectFromModal();
    }
  });
  elements.closePublishModalBtn.addEventListener("click", closePublishModal);
  elements.publishModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closePublishModal();
    }
  });
  elements.aboutBtn.addEventListener("click", openAboutModal);
  elements.closeAboutBtn.addEventListener("click", closeAboutModal);
  elements.dismissAboutBtn.addEventListener("click", closeAboutModal);
  elements.aboutModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeAboutModal();
    }
  });
  if (elements.accountBtn) {
    elements.accountBtn.addEventListener("click", () => {
      if (state.authUser && state.authUser.role === "manager") {
        window.location.href = "/publish/manager.php";
        return;
      }
      openAccountModal();
    });
  }
  if (elements.closeAccountModalBtn) {
    elements.closeAccountModalBtn.addEventListener("click", closeAccountModal);
  }
  if (elements.accountModal) {
    elements.accountModal.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-backdrop")) {
        closeAccountModal();
      }
    });
  }
  if (elements.loginSubmitBtn) {
    elements.loginSubmitBtn.addEventListener("click", handleLoginSubmit);
  }
  if (elements.loginPasswordInput) {
    elements.loginPasswordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleLoginSubmit();
      }
    });
  }
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener("click", async () => {
      await handleLogout();
      closeAccountModal();
    });
  }
  elements.dialogOkBtn.addEventListener("click", () => {
    if (dialogMode === "prompt") {
      closeDialog(elements.dialogInput.value);
    } else {
      closeDialog(true);
    }
  });
  elements.dialogCancelBtn.addEventListener("click", () => {
    closeDialog(dialogCancelResult());
  });
  elements.dialogCloseBtn.addEventListener("click", () => {
    closeDialog(dialogCancelResult());
  });
  elements.dialogModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeDialog(dialogCancelResult());
    }
  });
  elements.dialogInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      closeDialog(elements.dialogInput.value);
    }
  });
  elements.copyPublishUrlBtn.addEventListener("click", async () => {
    const url = elements.publishUrlText.textContent.trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Copied");
    } catch (error) {
      console.error(error);
      await showAlert("Copy failed. You can manually copy the URL.", "Copy URL");
    }
  });
  if (elements.copyPublishPasswordBtn) {
    elements.copyPublishPasswordBtn.addEventListener("click", async () => {
      const password = elements.publishPasswordText.textContent.trim();
      if (!password) return;
      try {
        await navigator.clipboard.writeText(password);
        setStatus("Copied");
      } catch (error) {
        console.error(error);
        await showAlert("Copy failed. You can manually copy the password.", "Copy password");
      }
    });
  }
  elements.openPublishUrlBtn.addEventListener("click", () => {
    const url = elements.openPublishUrlBtn.dataset.url;
    if (url) {
      window.open(url, "_blank", "noopener");
    }
  });
  elements.undoBtn.addEventListener("click", () => {
    if (codeMirror) {
      codeMirror.undo();
      codeMirror.focus();
      return;
    }
    elements.editor.focus();
    document.execCommand("undo");
  });
  elements.redoBtn.addEventListener("click", () => {
    if (codeMirror) {
      codeMirror.redo();
      codeMirror.focus();
      return;
    }
    elements.editor.focus();
    document.execCommand("redo");
  });
  elements.projectManagerBtn.addEventListener("click", () => toggleProjectManager());
  elements.closeProjectManagerBtn.addEventListener("click", () => toggleProjectManager(false));
  elements.renameProjectBtn.addEventListener("click", renameProject);
  elements.saveProjectBtn.addEventListener("click", saveCurrentProject);
  elements.saveProjectAsBtn.addEventListener("click", saveProjectAs);
  elements.projectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renameProject();
    }
  });
  elements.addFileBtn.addEventListener("click", async () => {
    const path = await showPrompt("New file path (e.g. assets/main.css):", "", "Add file");
    if (path) addFile(path);
  });
  elements.addFolderBtn.addEventListener("click", async () => {
    const base = state.currentFolderPath || "";
    const label = base
      ? `New folder name (inside ${base}):`
      : "New folder name (e.g. assets):";
    const input = await showPrompt(label, "", "New folder");
    if (!input) return;
    const path = base ? `${base}/${input}` : input;
    if (!addFolder(path)) {
      await showAlert("That folder already exists or is invalid.", "New folder");
    } else {
      renderFileTree();
      queueSave();
    }
  });
  elements.uploadFileBtn.addEventListener("click", () => elements.fileInput.click());
  elements.refreshPreviewBtn.addEventListener("click", renderPreview);
  elements.toggleFilePanelBtn.addEventListener("click", () => setFilePanelCollapsed(true));
  elements.expandFilePanelBtn.addEventListener("click", () => setFilePanelCollapsed(false));
  elements.splitter.addEventListener("pointerdown", startResize);

  elements.zipInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) {
      const name = file.name.toLowerCase();
      if (name.endsWith(".tgz") || name.endsWith(".tar.gz")) {
        importTgz(file);
      } else {
        importZip(file);
      }
    }
    event.target.value = "";
  });

  elements.fileInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      event.target.value = "";
      return;
    }
    const compressed = files.find((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".zip") || name.endsWith(".tgz") || name.endsWith(".tar.gz");
    });
    if (compressed) {
      await showAlert("Use Import to add ZIP/TGZ archives.", "Upload files");
      event.target.value = "";
      return;
    }
    handleFileUpload(files);
    event.target.value = "";
  });

  elements.fileTree.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    elements.fileTree.classList.add("drag-root");
  });
  elements.fileTree.addEventListener("dragleave", (event) => {
    if (event.target === elements.fileTree) {
      elements.fileTree.classList.remove("drag-root");
    }
  });
  elements.fileTree.addEventListener("drop", async (event) => {
    event.preventDefault();
    elements.fileTree.classList.remove("drag-root");
    const draggedPath = event.dataTransfer.getData("text/plain");
    if (!draggedPath) return;
    if (isFolderEntry(draggedPath)) {
      const folderPath = folderFromEntry(draggedPath);
      const targetPath = basename(folderPath);
      if (folderPath === targetPath) return;
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
    const targetPath = basename(draggedPath);
    if (draggedPath === targetPath) return;
    const result = renameFile(draggedPath, targetPath);
    if (!result.ok) {
      if (result.error) await showAlert(result.error, "Move file");
      return;
    }
    renderFileTree();
    queueSave();
    queuePreview();
  });

  document.addEventListener("click", (event) => {
    if (elements.projectManagerPanel.classList.contains("hidden")) return;
    const isInside = elements.projectManagerPanel.contains(event.target) ||
      elements.projectManagerBtn.contains(event.target);
    if (!isInside) toggleProjectManager(false);
  });

  registerTutorialTargets();
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

function applyStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    applyTheme(storedTheme);
    return;
  }
  const systemTheme = isDarkTheme(null) ? "dark" : "light";
  localStorage.setItem(THEME_STORAGE_KEY, systemTheme);
  applyTheme(systemTheme);
}

function updateProjectManagerFields() {
  if (!elements.projectNameInput) return;
  elements.projectNameInput.value = state.projectName;
  if (elements.currentProjectName) {
    elements.currentProjectName.textContent = state.projectName;
  }
  if (elements.projectTitleInput) {
    elements.projectTitleInput.value = state.projectName;
  }
  if (elements.projectCreatorInput) {
    elements.projectCreatorInput.value = state.projectCreator;
  }
  if (elements.projectDescriptionInput) {
    elements.projectDescriptionInput.value = state.projectDescription;
  }
}

function openProjectMetaModal() {
  updateProjectManagerFields();
  elements.projectMetaModal.classList.remove("hidden");
}

function closeProjectMetaModal() {
  elements.projectMetaModal.classList.add("hidden");
}

async function commitProjectMeta() {
  const nextName = normalizeProjectName(elements.projectTitleInput.value);
  const nextCreator = String(elements.projectCreatorInput.value || "").trim();
  const nextDescription = String(elements.projectDescriptionInput.value || "").trim();
  const changed = nextName !== state.projectName ||
    nextCreator !== state.projectCreator ||
    nextDescription !== state.projectDescription;
  if (!changed) return;
  state.projectName = nextName;
  state.projectCreator = nextCreator;
  state.projectDescription = nextDescription;
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
}

async function saveProjectMeta() {
  await commitProjectMeta();
  closeProjectMetaModal();
}

function openNewProjectModal() {
  elements.newProjectNameInput.value = state.projectName;
  elements.includeStarterFilesInput.checked = false;
  elements.newProjectModal.classList.remove("hidden");
  refreshIcons();
}

function closeNewProjectModal() {
  elements.newProjectModal.classList.add("hidden");
}

async function createNewProjectFromModal() {
  const confirmed = await showConfirm(
    "Start a new project? This will clear the current workspace.",
    "New project"
  );
  if (!confirmed) return;
  const name = elements.newProjectNameInput.value || DEFAULT_PROJECT_NAME;
  const includeStarter = elements.includeStarterFilesInput.checked;
  await resetProject({ name, includeStarter });
  closeNewProjectModal();
}

function openPublishModal(url) {
  elements.publishUrlText.textContent = url;
  elements.openPublishUrlBtn.dataset.url = url;
  if (elements.publishPasswordText) {
    elements.publishPasswordText.textContent = "";
  }
  if (elements.publishPasswordBlock) {
    elements.publishPasswordBlock.classList.add("hidden");
  }
  elements.publishModal.classList.remove("hidden");
}

function closePublishModal() {
  elements.publishModal.classList.add("hidden");
}

function initTutorialTooltip() {
  tutorialTooltip = document.createElement("div");
  tutorialTooltip.className = "tutorial-tooltip hidden";
  tutorialTooltip.innerHTML =
    "<div class=\"tutorial-tooltip-title\"></div><div class=\"tutorial-tooltip-body\"></div>";
  document.body.appendChild(tutorialTooltip);
}

function bindTutorialTarget(target) {
  if (!target || !target.dataset || !target.dataset.tutorial) return;
  target.addEventListener("mouseenter", () => showTutorialTooltip(target));
  target.addEventListener("mouseleave", hideTutorialTooltip);
  target.addEventListener("focus", () => showTutorialTooltip(target));
  target.addEventListener("blur", hideTutorialTooltip);
}

function positionTutorialTooltip(target) {
  if (!tutorialTooltip) return;
  const tooltipRect = tutorialTooltip.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const margin = 12;
  let top = rect.bottom + margin;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  if (top + tooltipRect.height > window.innerHeight - margin) {
    top = rect.top - tooltipRect.height - margin;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
  tutorialTooltip.style.top = `${Math.round(top)}px`;
  tutorialTooltip.style.left = `${Math.round(left)}px`;
}

function showTutorialTooltip(target) {
  if (!state.tutorialMode || !tutorialTooltip || !target) return;
  const body = target.dataset.tutorial;
  if (!body) return;
  const title = target.dataset.tutorialTitle || "Tip";
  const titleEl = tutorialTooltip.querySelector(".tutorial-tooltip-title");
  const bodyEl = tutorialTooltip.querySelector(".tutorial-tooltip-body");
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  tutorialTooltip.classList.remove("hidden");
  tutorialTooltip.classList.add("show");
  tutorialTarget = target;
  target.classList.add("tutorial-highlight");
  requestAnimationFrame(() => positionTutorialTooltip(target));
}

function hideTutorialTooltip() {
  if (!tutorialTooltip) return;
  tutorialTooltip.classList.remove("show");
  tutorialTooltip.classList.add("hidden");
  if (tutorialTarget) {
    tutorialTarget.classList.remove("tutorial-highlight");
    tutorialTarget = null;
  }
}

function registerTutorialTargets() {
  if (!tutorialTooltip) initTutorialTooltip();
  const targets = Array.from(document.querySelectorAll("[data-tutorial]"));
  targets.forEach((target) => bindTutorialTarget(target));
  window.addEventListener("resize", () => {
    if (tutorialTarget) positionTutorialTooltip(tutorialTarget);
  });
  window.addEventListener("scroll", hideTutorialTooltip, true);
}

function updateTutorialToggle() {
  if (!elements.tutorialToggleBtn) return;
  const hasBtnStyle = elements.tutorialToggleBtn.classList.contains("btn");
  const hasIconStyle = elements.tutorialToggleBtn.classList.contains("icon-btn");
  elements.tutorialToggleBtn.classList.toggle("btn-primary", state.tutorialMode && hasBtnStyle);
  elements.tutorialToggleBtn.classList.toggle("is-active", state.tutorialMode && hasIconStyle);
  elements.tutorialToggleBtn.setAttribute(
    "aria-pressed",
    state.tutorialMode ? "true" : "false"
  );
  elements.tutorialToggleBtn.title = state.tutorialMode
    ? "Tutorial mode: On"
    : "Tutorial mode: Off";
}

function setTutorialMode(enabled) {
  state.tutorialMode = enabled;
  localStorage.setItem(TUTORIAL_STORAGE_KEY, enabled ? "1" : "0");
  document.body.classList.toggle("tutorial-mode", enabled);
  updateTutorialToggle();
  if (!enabled) hideTutorialTooltip();
}

function toggleTutorialMode() {
  setTutorialMode(!state.tutorialMode);
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

async function ensurePublishMetadata() {
  if (state.projectCreator && state.projectDescription) {
    return true;
  }
  const creator = state.projectCreator ||
    await showPrompt("Creator name:", state.projectCreator, "Project details");
  if (creator === null) return false;
  const description = state.projectDescription ||
    await showPrompt("Project description:", state.projectDescription, "Project details");
  if (description === null) return false;
  state.projectCreator = String(creator || "").trim();
  state.projectDescription = String(description || "").trim();
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  return true;
}

async function renderProjectManager() {
  updateProjectManagerFields();
  if (!elements.projectList) return;
  const projects = await dbGetAll();
  const sorted = projects
    .filter((item) => item.data && item.data.files?.length)
    .sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));

  elements.projectList.innerHTML = "";
  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.className = "project-item";
    empty.textContent = "No saved projects yet.";
    elements.projectList.appendChild(empty);
    return;
  }

  for (const project of sorted) {
    const item = document.createElement("div");
    item.className = "project-item";
    if (project.id === state.projectId) item.classList.add("active");

    const meta = document.createElement("div");
    meta.className = "project-meta";

    const name = document.createElement("div");
    name.className = "project-name";
    name.textContent = normalizeProjectName(project.data?.name);

    const updated = document.createElement("div");
    updated.className = "project-updated";
    const timestamp = project.data?.updatedAt ? new Date(project.data.updatedAt) : null;
    updated.textContent = timestamp ? `Updated ${timestamp.toLocaleString()}` : "Saved";

    meta.append(name, updated);

    const actions = document.createElement("div");
    actions.className = "project-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "project-action";
    openBtn.textContent = project.id === state.projectId ? "Current" : "Open";
    openBtn.disabled = project.id === state.projectId;
    openBtn.addEventListener("click", () => loadProjectById(project.id));

    const renameBtn = document.createElement("button");
    renameBtn.className = "project-action";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", () => renameProjectById(project.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "project-action danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = project.id === state.projectId;
    deleteBtn.addEventListener("click", () => deleteProjectById(project.id));

    actions.append(openBtn, renameBtn, deleteBtn);
    item.append(meta, actions);
    elements.projectList.appendChild(item);
  }
}

function toggleProjectManager(force) {
  const isOpen = !elements.projectManagerPanel.classList.contains("hidden");
  const nextOpen = typeof force === "boolean" ? force : !isOpen;
  elements.projectManagerPanel.classList.toggle("hidden", !nextOpen);
  if (nextOpen) {
    renderProjectManager();
  }
}

async function loadProjectById(projectId) {
  const project = await dbGet(projectId);
  if (!project || !project.files?.length) return;
  state.projectId = projectId;
  state.projectName = normalizeProjectName(project.name);
  localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
  loadProject(project);
  renderFileTree();
  openFirstFile();
  renderPreview();
  renderProjectManager();
}

async function renameProjectById(projectId) {
  const project = await dbGet(projectId);
  if (!project) return;
  const currentName = normalizeProjectName(project.name);
  const name = await showPrompt("Rename project:", currentName, "Rename project");
  if (!name) return;
  const updatedProject = { ...project, name: normalizeProjectName(name), updatedAt: Date.now() };
  await dbSet(projectId, updatedProject);
  if (projectId === state.projectId) {
    state.projectName = updatedProject.name;
  }
  renderProjectManager();
}

async function deleteProjectById(projectId) {
  const confirmed = await showConfirm("Delete this project? This cannot be undone.", "Delete project");
  if (!confirmed) return;
  await dbDelete(projectId);
  renderProjectManager();
}

async function saveCurrentProject() {
  try {
    localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
    await dbSet(state.projectId, serializeProject());
    setStatus("Saved");
    renderProjectManager();
  } catch (error) {
    console.error(error);
    setStatus("Save failed", 2000);
  }
}

async function saveProjectAs() {
  const name = await showPrompt("Save project as:", state.projectName, "Save project as");
  if (!name) return;
  state.projectId = createProjectId();
  state.projectName = normalizeProjectName(name);
  localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  setStatus("Saved");
}

async function renameProject() {
  const name = normalizeProjectName(elements.projectNameInput.value);
  state.projectName = name;
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  setStatus("Renamed");
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

function initCodeMirror() {
  if (!window.CodeMirror) return;
  codeMirror = window.CodeMirror.fromTextArea(elements.editor, {
    lineNumbers: true,
    lineWrapping: lineWrappingEnabled,
    matchBrackets: true,
    autoCloseBrackets: true,
    autoCloseTags: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    theme: "material-darker",
    mode: "htmlmixed",
  });
  codeMirror.setSize("100%", "100%");
}

function applyLineWrapSetting() {
  if (codeMirror) {
    codeMirror.setOption("lineWrapping", lineWrappingEnabled);
  } else {
    elements.editor.wrap = lineWrappingEnabled ? "soft" : "off";
  }
  const label = lineWrappingEnabled ? "Line wrap: On" : "Line wrap: Off";
  elements.wrapToggleBtn.title = `${label} (toggle)`;
  elements.wrapToggleBtn.classList.toggle("is-active", lineWrappingEnabled);
}

function toggleLineWrap() {
  lineWrappingEnabled = !lineWrappingEnabled;
  localStorage.setItem(LINE_WRAP_KEY, lineWrappingEnabled ? "1" : "0");
  applyLineWrapSetting();
}

lineWrappingEnabled = localStorage.getItem(LINE_WRAP_KEY) === "1";
state.tutorialMode = localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
initCodeMirror();
refreshIcons();
applyLineWrapSetting();
applyStoredTheme();
applyEditorTheme(localStorage.getItem(EDITOR_THEME_KEY));
applyStoredLayout();
setupEvents();
setTutorialMode(state.tutorialMode);
setAuthUser(null);
fetchSession();
loadInitialProject();
