import { client } from "./lib/edgespark";
import { t, onLangChange } from "./i18n";

let boardEl: HTMLElement;
let backdropEl: HTMLElement;
let listEl: HTMLElement;
let formEl: HTMLElement;
let inputEl: HTMLTextAreaElement;
let submitBtn: HTMLButtonElement;
let loginHintEl: HTMLElement;
let adminTabBtn: HTMLElement;
let publicTabBtn: HTMLElement;
let adminListEl: HTMLElement;
let adminPanelEl: HTMLElement;
let charCountEl: HTMLElement;

let isOpen = false;
let isAdminUser = false;
let isLoggedIn = false;

interface Message {
  id: number;
  user_name: string;
  content: string;
  visible?: number;
  created_at: string;
}

export function initMessageBoard() {
  boardEl = document.getElementById("board-modal")!;
  backdropEl = document.getElementById("board-backdrop")!;
  listEl = document.getElementById("board-list")!;
  formEl = document.getElementById("board-form")!;
  inputEl = document.getElementById("board-input") as HTMLTextAreaElement;
  submitBtn = document.getElementById("board-submit") as HTMLButtonElement;
  loginHintEl = document.getElementById("board-login-hint")!;
  adminTabBtn = document.getElementById("board-tab-admin")!;
  publicTabBtn = document.getElementById("board-tab-public")!;
  adminListEl = document.getElementById("board-admin-list")!;
  adminPanelEl = document.getElementById("board-admin-panel")!;
  charCountEl = document.getElementById("board-char-count")!;

  backdropEl.addEventListener("click", closeBoard);
  document.getElementById("board-close")!.addEventListener("click", closeBoard);

  submitBtn.addEventListener("click", handleSubmit);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  });
  inputEl.addEventListener("input", () => {
    const len = inputEl.value.length;
    charCountEl.textContent = `${len}/500`;
    charCountEl.style.color = len > 450 ? "#ef6b73" : "rgba(255,255,255,0.35)";
  });

  publicTabBtn.addEventListener("click", () => switchTab("public"));
  adminTabBtn.addEventListener("click", () => switchTab("admin"));

  onLangChange(() => {
    if (isOpen) updateLabels();
  });
}

function updateLabels() {
  document.getElementById("board-title")!.textContent = t("boardTitle");
  submitBtn.textContent = t("boardSend");
  inputEl.placeholder = t("boardPlaceholder");
  loginHintEl.textContent = t("boardLoginHint");
  publicTabBtn.textContent = t("boardTabPublic");
  adminTabBtn.textContent = t("boardTabAdmin");
}

export async function openBoard() {
  if (isOpen) return;
  isOpen = true;

  // Check auth + admin status
  try {
    const res = await client.api.fetch("/api/public/me");
    const data = await res.json() as { user: { id: string; name: string; email: string } | null; isAdmin: boolean };
    isLoggedIn = !!data.user;
    isAdminUser = data.isAdmin;
  } catch {
    isLoggedIn = false;
    isAdminUser = false;
  }

  // Show/hide form vs login hint
  formEl.style.display = isLoggedIn ? "flex" : "none";
  loginHintEl.style.display = isLoggedIn ? "none" : "block";

  // Show/hide admin tab
  adminTabBtn.style.display = isAdminUser ? "inline-block" : "none";
  switchTab("public");

  updateLabels();

  boardEl.style.display = "flex";
  requestAnimationFrame(() => {
    boardEl.style.opacity = "1";
  });

  await loadPublicMessages();
}

export function closeBoard() {
  if (!isOpen) return;
  isOpen = false;
  boardEl.style.opacity = "0";
  setTimeout(() => {
    boardEl.style.display = "none";
  }, 250);
}

function switchTab(tab: "public" | "admin") {
  publicTabBtn.classList.toggle("active", tab === "public");
  adminTabBtn.classList.toggle("active", tab === "admin");
  listEl.style.display = tab === "public" ? "block" : "none";
  adminPanelEl.style.display = tab === "admin" ? "block" : "none";

  if (tab === "admin" && isAdminUser) {
    loadAdminMessages();
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso + "Z");
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("boardJustNow");
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return d.toLocaleDateString();
}

function renderMessages(messages: Message[], container: HTMLElement) {
  if (messages.length === 0) {
    container.innerHTML = `<div class="board-empty">${t("boardEmpty")}</div>`;
    return;
  }
  container.innerHTML = messages
    .map(
      (m) => `
    <div class="board-msg">
      <div class="board-msg-header">
        <span class="board-msg-name">${escapeHtml(m.user_name)}</span>
        <span class="board-msg-time">${formatTime(m.created_at)}</span>
      </div>
      <div class="board-msg-content">${escapeHtml(m.content)}</div>
    </div>
  `
    )
    .join("");
}

function renderAdminMessages(messages: Message[]) {
  if (messages.length === 0) {
    adminListEl.innerHTML = `<div class="board-empty">${t("boardEmpty")}</div>`;
    return;
  }
  adminListEl.innerHTML = messages
    .map(
      (m) => `
    <div class="board-msg board-msg-admin ${m.visible ? "" : "board-msg-hidden"}">
      <div class="board-msg-header">
        <span class="board-msg-name">${escapeHtml(m.user_name)}</span>
        <span class="board-msg-time">${formatTime(m.created_at)}</span>
        <span class="board-msg-status">${m.visible ? "✓" : "hidden"}</span>
      </div>
      <div class="board-msg-content">${escapeHtml(m.content)}</div>
      <div class="board-msg-actions">
        <button class="board-action-btn" data-action="toggle" data-id="${m.id}" data-visible="${m.visible}">
          ${m.visible ? t("boardHide") : t("boardShow")}
        </button>
        <button class="board-action-btn board-action-delete" data-action="delete" data-id="${m.id}">
          ${t("boardDelete")}
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Bind action buttons
  adminListEl.querySelectorAll<HTMLButtonElement>(".board-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id!;
      const action = btn.dataset.action!;
      if (action === "toggle") {
        const currentVisible = parseInt(btn.dataset.visible!, 10);
        await client.api.fetch(`/api/messages/${id}/visibility`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visible: currentVisible ? 0 : 1 }),
        });
        await loadAdminMessages();
      } else if (action === "delete") {
        await client.api.fetch(`/api/messages/${id}`, { method: "DELETE" });
        await loadAdminMessages();
      }
    });
  });
}

async function loadPublicMessages() {
  try {
    const res = await client.api.fetch("/api/public/messages");
    const data = await res.json() as { messages: Message[] };
    renderMessages(data.messages, listEl);
  } catch {
    listEl.innerHTML = `<div class="board-empty">Failed to load</div>`;
  }
}

async function loadAdminMessages() {
  try {
    const res = await client.api.fetch("/api/messages/admin");
    const data = await res.json() as { messages: Message[] };
    renderAdminMessages(data.messages);
  } catch {
    adminListEl.innerHTML = `<div class="board-empty">Failed to load</div>`;
  }
}

async function handleSubmit() {
  const content = inputEl.value.trim();
  if (!content) return;

  submitBtn.disabled = true;
  try {
    const res = await client.api.fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      inputEl.value = "";
      charCountEl.textContent = "0/500";
      await loadPublicMessages();
    }
  } finally {
    submitBtn.disabled = false;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function setupBoardButton() {
  const fab = document.getElementById("guestbook-fab");
  if (fab) {
    fab.addEventListener("click", () => openBoard());
  }
}
