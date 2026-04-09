import { client } from "./lib/edgespark";
import { enUS, zhCN } from "@edgespark/web";
import { getCurrentLang, onLangChange, t } from "./i18n";

let modalEl: HTMLElement;
let backdropEl: HTMLElement;
let containerEl: HTMLElement;
let closeBtnEl: HTMLElement;
let mounted: { destroy(): void } | null = null;
let isLoggedIn = false;

function getAuthLabels() {
  return getCurrentLang() === "cn" ? zhCN : enUS;
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

  // remount auth UI when language changes (if modal is open)
  onLangChange(() => {
    if (mounted) {
      mounted.destroy();
      mounted = null;
      mountAuthUI();
    }
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
  // don't open auth modal if already logged in
  if (isLoggedIn) return;

  modalEl.style.display = "flex";
  requestAnimationFrame(() => {
    modalEl.style.opacity = "1";
  });

  if (!mounted) {
    mountAuthUI();
  }
}

export function closeModal() {
  modalEl.style.opacity = "0";
  setTimeout(() => {
    modalEl.style.display = "none";
    if (mounted) {
      mounted.destroy();
      mounted = null;
    }
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
