// Glitchlet — Tutorial mode tooltips.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

let tutorialTooltip = null;
let tutorialTarget = null;

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
