// Glitchlet — IndexedDB persistence and project (de)serialization.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

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
      resolve(
        keys.map((key, index) => ({
          id: String(key),
          data: values[index] || null,
        })),
      );
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

// Use sessionStorage to get the application connection state when launched as a PWA. Listen for messages from the service worker to handle interacting with the sessionStorage bucket.
const buttonsToDisable = ["publishBtn", "accountBtn", "publishedProjectsBtn"];

// Listen for the network changing.
self.addEventListener("online", handleConnection);
self.addEventListener("offline", handleConnection);

function handleConnection() {
  // Get the initial state of the app from sessionStorage
  // Convert the string value into bool with JSON.parse
  let hasConnection = JSON.parse(
    window.sessionStorage.getItem("hasConnection"),
  );
  console.log(hasConnection);
  // Set the state to whatever it is not
  toggleDisabledState(hasConnection);

  // Toggle the sessionStorage value
  window.sessionStorage.setItem("hasConnection", !hasConnection);
}

function toggleDisabledState(state) {
  // Take the button array and either add or remove `disabled` based on the state passed
  // 1. iterate the array
  // 2. For each item, add the state value
  for (let button of buttonsToDisable) {
    elements[button].setAttribute("disabled", state);
  }
}

async function isReachable(url) {
  console.log("Trying to reach an address");
  try {
    let req = await fetch(url, { method: "HEAD", mode: "no-cors" });
    return req && (req.ok || req.type === "opaque");
  } catch (err) {
    console.warn("[connection test failure]: ", err);
    return err;
  }
}

async function setInitialConnectionState() {
  let initialConnectionState = await isReachable("/");
  if (!initialConnectionState) {
    window.sessionStorage.setItem("hasConnection", "false");
  } else {
    window.sessionStorage.setItem("hasConnection", "true");
  }
}
