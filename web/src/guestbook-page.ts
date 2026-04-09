import { client } from "./lib/edgespark";
import { t, initI18n, onLangChange } from "./i18n";

interface Message {
  id: number;
  user_name: string;
  content: string;
  visible?: number;
  created_at: string;
}

let isAdminUser = false;
let isLoggedIn = false;

// DOM refs
let listEl: HTMLElement;
let adminListEl: HTMLElement;
let adminPanelEl: HTMLElement;
let formEl: HTMLElement;
let inputEl: HTMLTextAreaElement;
let submitBtn: HTMLButtonElement;
let loginHintEl: HTMLElement;
let charCountEl: HTMLElement;
let publicTabBtn: HTMLElement;
let adminTabBtn: HTMLElement;

export async function initGuestbookPage() {
  buildPageDOM();
  initI18n();

  // Check auth
  try {
    const res = await client.api.fetch("/api/public/me");
    const data = (await res.json()) as {
      user: { id: string; name: string; email: string } | null;
      isAdmin: boolean;
    };
    isLoggedIn = !!data.user;
    isAdminUser = data.isAdmin;
  } catch {
    isLoggedIn = false;
    isAdminUser = false;
  }

  // Bind refs
  listEl = document.getElementById("gb-list")!;
  adminListEl = document.getElementById("gb-admin-list")!;
  adminPanelEl = document.getElementById("gb-admin-panel")!;
  formEl = document.getElementById("gb-form")!;
  inputEl = document.getElementById("gb-input") as HTMLTextAreaElement;
  submitBtn = document.getElementById("gb-submit") as HTMLButtonElement;
  loginHintEl = document.getElementById("gb-login-hint")!;
  charCountEl = document.getElementById("gb-char-count")!;
  publicTabBtn = document.getElementById("gb-tab-public")!;
  adminTabBtn = document.getElementById("gb-tab-admin")!;

  // Show/hide based on auth
  formEl.style.display = isLoggedIn ? "flex" : "none";
  loginHintEl.style.display = isLoggedIn ? "none" : "block";
  adminTabBtn.style.display = isAdminUser ? "inline-block" : "none";

  // Update logged-in header
  if (isLoggedIn) {
    try {
      const session = await client.auth.getSession();
      if (session?.data?.user) {
        const nameEl = document.getElementById("gb-signin");
        if (nameEl) {
          nameEl.textContent = session.data.user.name || session.data.user.email || "User";
        }
      }
    } catch { /* ignore */ }
  }

  // Events
  submitBtn.addEventListener("click", handleSubmit);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  });
  inputEl.addEventListener("input", () => {
    const len = inputEl.value.length;
    charCountEl.textContent = `${len}/500`;
    charCountEl.style.color = len > 450 ? "#ef6b73" : "rgba(255,255,255,0.35)";
  });
  publicTabBtn.addEventListener("click", () => switchTab("public"));
  adminTabBtn.addEventListener("click", () => switchTab("admin"));

  onLangChange(() => updateLabels());
  updateLabels();

  await loadPublicMessages();
}

function buildPageDOM() {
  // Hide canvas and 3D overlays
  document.getElementById("canvas")!.style.display = "none";
  document.getElementById("warp-overlay")!.style.display = "none";
  document.getElementById("title")!.style.display = "none";
  document.getElementById("scroll-hint")!.style.display = "none";
  document.getElementById("space-hint")!.style.display = "none";
  document.getElementById("scene-indicator")!.style.display = "none";
  document.getElementById("project-info")!.style.display = "none";
  const fab = document.getElementById("guestbook-fab");
  if (fab) fab.style.display = "none";

  // Show header title
  const headerTitle = document.getElementById("header-title")!;
  headerTitle.style.opacity = "1";
  headerTitle.style.pointerEvents = "auto";
  headerTitle.style.cursor = "pointer";
  headerTitle.addEventListener("click", () => {
    window.location.href = "/";
  });

  // Insert guestbook page content
  const page = document.createElement("div");
  page.id = "guestbook-page";
  page.innerHTML = `
    <div id="gb-container">
      <h1 id="gb-title">${t("boardTitle")}</h1>
      <div id="gb-tabs">
        <button id="gb-tab-public" class="gb-tab active">${t("boardTabPublic")}</button>
        <button id="gb-tab-admin" class="gb-tab" style="display:none">${t("boardTabAdmin")}</button>
      </div>
      <div id="gb-list"></div>
      <div id="gb-admin-panel" style="display:none">
        <div id="gb-admin-list"></div>
      </div>
      <div id="gb-form" style="display:none">
        <textarea id="gb-input" maxlength="500" rows="3" placeholder="${t("boardPlaceholder")}"></textarea>
        <div id="gb-form-footer">
          <span id="gb-char-count">0/500</span>
          <button id="gb-submit">${t("boardSend")}</button>
        </div>
      </div>
      <div id="gb-login-hint" style="display:none">${t("boardLoginHint")}</div>
    </div>
  `;
  document.body.appendChild(page);
}

function updateLabels() {
  const titleEl = document.getElementById("gb-title");
  if (titleEl) titleEl.textContent = t("boardTitle");
  if (submitBtn) submitBtn.textContent = t("boardSend");
  if (inputEl) inputEl.placeholder = t("boardPlaceholder");
  if (loginHintEl) loginHintEl.textContent = t("boardLoginHint");
  if (publicTabBtn) publicTabBtn.textContent = t("boardTabPublic");
  if (adminTabBtn) adminTabBtn.textContent = t("boardTabAdmin");
}

function switchTab(tab: "public" | "admin") {
  publicTabBtn.classList.toggle("active", tab === "public");
  adminTabBtn.classList.toggle("active", tab === "admin");
  listEl.style.display = tab === "public" ? "block" : "none";
  adminPanelEl.style.display = tab === "admin" ? "block" : "none";
  if (tab === "admin" && isAdminUser) loadAdminMessages();
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

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMessages(messages: Message[], container: HTMLElement) {
  if (messages.length === 0) {
    container.innerHTML = `<div class="gb-empty">${t("boardEmpty")}</div>`;
    return;
  }
  container.innerHTML = messages
    .map(
      (m) => `
    <div class="gb-msg">
      <div class="gb-msg-header">
        <span class="gb-msg-name">${escapeHtml(m.user_name)}</span>
        <span class="gb-msg-time">${formatTime(m.created_at)}</span>
      </div>
      <div class="gb-msg-content">${escapeHtml(m.content)}</div>
    </div>`
    )
    .join("");
}

function renderAdminMessages(messages: Message[]) {
  if (messages.length === 0) {
    adminListEl.innerHTML = `<div class="gb-empty">${t("boardEmpty")}</div>`;
    return;
  }
  adminListEl.innerHTML = messages
    .map(
      (m) => `
    <div class="gb-msg ${m.visible ? "" : "gb-msg-hidden"}">
      <div class="gb-msg-header">
        <span class="gb-msg-name">${escapeHtml(m.user_name)}</span>
        <span class="gb-msg-time">${formatTime(m.created_at)}</span>
        <span class="gb-msg-status">${m.visible ? "visible" : "hidden"}</span>
      </div>
      <div class="gb-msg-content">${escapeHtml(m.content)}</div>
      <div class="gb-msg-actions">
        <button class="gb-action-btn" data-action="toggle" data-id="${m.id}" data-visible="${m.visible}">
          ${m.visible ? t("boardHide") : t("boardShow")}
        </button>
        <button class="gb-action-btn gb-action-delete" data-action="delete" data-id="${m.id}">
          ${t("boardDelete")}
        </button>
      </div>
    </div>`
    )
    .join("");

  adminListEl.querySelectorAll<HTMLButtonElement>(".gb-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id!;
      const action = btn.dataset.action!;
      if (action === "toggle") {
        const curVisible = parseInt(btn.dataset.visible!, 10);
        await client.api.fetch(`/api/messages/${id}/visibility`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visible: curVisible ? 0 : 1 }),
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
    const data = (await res.json()) as { messages: Message[] };
    renderMessages(data.messages, listEl);
  } catch {
    listEl.innerHTML = `<div class="gb-empty">Failed to load</div>`;
  }
}

async function loadAdminMessages() {
  try {
    const res = await client.api.fetch("/api/messages/admin");
    const data = (await res.json()) as { messages: Message[] };
    renderAdminMessages(data.messages);
  } catch {
    adminListEl.innerHTML = `<div class="gb-empty">Failed to load</div>`;
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
