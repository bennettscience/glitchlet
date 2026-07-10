// Glitchlet — CodeMirror wiring and editor helpers.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

let codeMirror = null;
let lineWrappingEnabled = false;

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
    await showAlert(
      "Prettier is still loading. Try again in a moment.",
      "Prettify",
    );
    return;
  }
  const ext = extname(path);
  let parser = null;
  if (ext === "js") parser = "babel";
  if (ext === "css") parser = "css";
  if (ext === "html" || ext === "htm") parser = "html";
  if (!parser) {
    await showAlert(
      "Prettify supports HTML, CSS, and JavaScript files.",
      "Prettify",
    );
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
    await showAlert(
      "Prettify failed. Check the console for details.",
      "Prettify",
    );
  }
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
