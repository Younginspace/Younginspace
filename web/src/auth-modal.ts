import { client } from "./lib/edgespark";
import { enUS, zhCN } from "@edgespark/web";
import { getCurrentLang, onLangChange, t } from "./i18n";

let modalEl: HTMLElement;
let backdropEl: HTMLElement;
let containerEl: HTMLElement;
let closeBtnEl: HTMLElement;
let mounted: { destroy(): void } | null = null;
let isLoggedIn = false;
let authReady = false;
let pendingOpen = false;
let readyObserver: MutationObserver | null = null;

function getAuthLabels() {
  const base = getCurrentLang() === "cn" ? zhCN : enUS;
  return {
    ...base,
    signUp: {
      ...base.signUp,
      nameLabel: getCurrentLang() === "cn" ? "姓名（选填）" : "Name (optional)",
    },
  };
}

export function initAuthModal() {
  modalEl = document.getElementById("auth-modal")!;
  backdropEl = document.getElementById("auth-backdrop")!;
  containerEl = document.getElementById("auth-container")!;
  closeBtnEl = document.getElementById("auth-close")!;

  closeBtnEl.addEventListener("click", closeModal);
  backdropEl.addEventListener("click", closeModal);

  // close user dropdown when clicking elsewhere
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("user-dropdown");
    const signinLink = document.querySelector(".nav-signin");
    if (dropdown && !dropdown.contains(e.target as Node) && e.target !== signinLink) {
      dropdown.style.display = "none";
    }
  });

  // remount auth UI when language changes
  onLangChange(() => {
    if (mounted) {
      const wasVisible = modalEl.style.visibility === "visible";
      mounted.destroy();
      mounted = null;
      if (wasVisible) pendingOpen = true;
      preloadAuthUI();
    }
  });

  // Pre-mount auth UI invisibly so it's ready when user clicks Sign In
  preloadAuthUI();
}

function preloadAuthUI() {
  authReady = false;
  mountAuthUI();

  // Watch for auth UI to finish loading (input elements appear = form is ready)
  readyObserver = new MutationObserver(() => {
    if (containerEl.querySelector("input")) {
      markAuthReady();
    }
  });
  readyObserver.observe(containerEl, { childList: true, subtree: true });

  // Safety fallback: allow opening after 5s even if observer didn't fire
  setTimeout(() => {
    if (!authReady) markAuthReady();
  }, 5000);
}

function markAuthReady() {
  if (authReady) return;
  authReady = true;
  if (readyObserver) {
    readyObserver.disconnect();
    readyObserver = null;
  }
  if (pendingOpen) {
    pendingOpen = false;
    revealModal();
  }
}

function revealModal() {
  modalEl.style.visibility = "visible";
  modalEl.style.pointerEvents = "auto";
  requestAnimationFrame(() => {
    modalEl.style.opacity = "1";
  });
}

function mountAuthUI() {
  mounted = client.authUI.mount(containerEl, {
    labels: getAuthLabels(),
    onSuccess(event) {
      if (event.action !== "password-reset") {
        closeModal();
        updateHeaderForUser();
      }
    },
    onError(error) {
      console.error("Auth error:", error.code, error.message);
    },
  });
}

export async function openModal() {
  if (isLoggedIn) return;

  if (!authReady) {
    // Auth UI still loading — queue open, modal will show automatically when ready
    pendingOpen = true;
    if (!mounted) preloadAuthUI();
    return;
  }

  revealModal();
}

export function closeModal() {
  modalEl.style.opacity = "0";
  setTimeout(() => {
    modalEl.style.visibility = "hidden";
    modalEl.style.pointerEvents = "none";
    // Keep auth UI mounted — avoids "Loading sign-in..." on next open
  }, 250);
}

function switchToLoggedIn(name: string) {
  isLoggedIn = true;
  const signinLink = document.querySelector(".nav-signin") as HTMLElement;
  const dropdown = document.getElementById("user-dropdown")!;
  const signoutBtn = document.getElementById("signout-btn")!;

  signinLink.textContent = name;
  signinLink.classList.add("logged-in");

  // click toggles dropdown
  signinLink.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  };

  // sign out
  signoutBtn.onclick = async () => {
    dropdown.style.display = "none";
    await client.auth.signOut();
    switchToLoggedOut();
  };
}

function switchToLoggedOut() {
  isLoggedIn = false;
  const signinLink = document.querySelector(".nav-signin") as HTMLElement;
  signinLink.textContent = t("signin");
  signinLink.classList.remove("logged-in");
  signinLink.onclick = (e) => {
    e.preventDefault();
    openModal();
  };

  // Reset auth UI so next sign-in shows a fresh form (pre-loaded in background)
  if (mounted) {
    mounted.destroy();
    mounted = null;
  }
  pendingOpen = false;
  preloadAuthUI();
}

export async function updateHeaderForUser() {
  try {
    const session = await client.auth.getSession();
    if (session?.data?.user) {
      const name = session.data.user.name || session.data.user.email || "User";
      switchToLoggedIn(name);
    }
  } catch {
    // not signed in
  }
}

export function setupSignInButton() {
  const signinLink = document.querySelector(".nav-signin") as HTMLElement;
  signinLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isLoggedIn) openModal();
  });
}
