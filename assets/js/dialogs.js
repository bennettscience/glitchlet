// Glitchlet — Reusable dialog modal (alert/confirm/prompt) and icon refresh.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

let dialogResolver = null;
let dialogMode = "alert";

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
