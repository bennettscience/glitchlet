// Glitchlet — App and editor theme handling.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

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
