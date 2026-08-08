// Glitchlet — Project lifecycle, metadata modals, and the project manager panel.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

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
  const nextDescription = String(
    elements.projectDescriptionInput.value || "",
  ).trim();
  const changed =
    nextName !== state.projectName ||
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
    "New project",
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

async function ensurePublishMetadata() {
  if (state.projectCreator && state.projectDescription) {
    return true;
  }
  const creator =
    state.projectCreator ||
    (await showPrompt(
      "Creator name:",
      state.projectCreator,
      "Project details",
    ));
  if (creator === null) return false;

  const description =
    state.projectDescription ||
    (await showPrompt(
      "Project description:",
      state.projectDescription,
      "Project details",
    ));
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
    const timestamp = project.data?.updatedAt
      ? new Date(project.data.updatedAt)
      : null;
    updated.textContent = timestamp
      ? `Updated ${timestamp.toLocaleString()}`
      : "Saved";

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
  const name = await showPrompt(
    "Rename project:",
    currentName,
    "Rename project",
  );
  if (!name) return;
  const updatedProject = {
    ...project,
    name: normalizeProjectName(name),
    updatedAt: Date.now(),
  };
  await dbSet(projectId, updatedProject);
  if (projectId === state.projectId) {
    state.projectName = updatedProject.name;
  }
  renderProjectManager();
}

async function deleteProjectById(projectId) {
  const confirmed = await showConfirm(
    "Delete this project? This cannot be undone.",
    "Delete project",
  );
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
  const name = await showPrompt(
    "Save project as:",
    state.projectName,
    "Save project as",
  );
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
