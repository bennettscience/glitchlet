// Glitchlet — Event wiring and app startup. Must load last.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

function setupEvents() {
  if (codeMirror) {
    codeMirror.on("change", () => {
      if (state.suppressEditorChange) return;
      updateCurrentFile(getEditorValue());
      queueSave();
      queuePreview();
    });
    codeMirror.on("keyup", (cm, evt) => {
      if (
        !cm.state.completionActive &&
        !EXCLUDE_AUTOCOMPLETE_KEYS[(evt.keyCode || evt.which).toString()]
      )
        cm.showHint({
          completeSingle: false,
        });
    });
  } else {
    elements.editor.addEventListener("input", () => {
      updateCurrentFile(elements.editor.value);
      queueSave();
      queuePreview();
    });
  }

  elements.newProjectBtn.addEventListener("click", openNewProjectModal);
  elements.importZipBtn.addEventListener("click", () =>
    elements.zipInput.click(),
  );
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
      await showAlert(
        "Folding is only available in the code editor.",
        "Unfold",
      );
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
  elements.createProjectBtn.addEventListener(
    "click",
    createNewProjectFromModal,
  );
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
        window.location.href = "/admin/manager.php";
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
      await showAlert(
        "Copy failed. You can manually copy the URL.",
        "Copy URL",
      );
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
        await showAlert(
          "Copy failed. You can manually copy the password.",
          "Copy password",
        );
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
  elements.projectManagerBtn.addEventListener("click", () =>
    toggleProjectManager(),
  );
  elements.closeProjectManagerBtn.addEventListener("click", () =>
    toggleProjectManager(false),
  );
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
    const path = await showPrompt(
      "New file path (e.g. assets/main.css):",
      "",
      "Add file",
    );
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
      await showAlert(
        "That folder already exists or is invalid.",
        "New folder",
      );
    } else {
      renderFileTree();
      queueSave();
    }
  });
  elements.uploadFileBtn.addEventListener("click", () =>
    elements.fileInput.click(),
  );
  elements.refreshPreviewBtn.addEventListener("click", renderPreview);
  elements.toggleFilePanelBtn.addEventListener("click", () =>
    setFilePanelCollapsed(true),
  );
  elements.expandFilePanelBtn.addEventListener("click", () =>
    setFilePanelCollapsed(false),
  );
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
      return (
        name.endsWith(".zip") ||
        name.endsWith(".tgz") ||
        name.endsWith(".tar.gz")
      );
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
    const isInside =
      elements.projectManagerPanel.contains(event.target) ||
      elements.projectManagerBtn.contains(event.target);
    if (!isInside) toggleProjectManager(false);
  });

  registerTutorialTargets();
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
setInitialConnectionState();
loadInitialProject();
