// Glitchlet — Session, login/logout, and account UI.
// Loaded as a classic script; shares the global scope with the other
// files in assets/js/ (see the script tags in index.html for load order).

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
    elements.accountManagerLink.classList.toggle(
      "hidden",
      !user || user.role !== "manager",
    );
  }
}

async function fetchSession() {
  try {
    const response = await fetch("/admin/session.php", {
      credentials: "include",
    });
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
    const response = await fetch("/admin/login.php", {
      method: "POST",
      redirect: "follow",
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
      elements.loginError.textContent =
        "Login failed. Check your email or password.";
    }
  } finally {
    if (elements.loginSubmitBtn) {
      elements.loginSubmitBtn.disabled = false;
    }
  }
}

async function handleLogout() {
  try {
    await fetch("/admin/logout.php", {
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
