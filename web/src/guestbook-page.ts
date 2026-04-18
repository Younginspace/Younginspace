import { client } from "./lib/edgespark";
import { t, onLangChange } from "./i18n";

interface Message {
  id: number;
  user_name: string;
  content: string;
  created_at: string;
  visible?: number;
  admin_reply: string | null;
  admin_reply_at: string | null;
  like_count: number;
  has_liked: boolean;
}

interface MeResponse {
  user: { id: string; name: string; email: string } | null;
  isAdmin: boolean;
}

// Module-local state — only valid while mounted. unmountGuestbook resets it.
let me: MeResponse = { user: null, isAdmin: false };
let publicMessages: Message[] = [];
let myMessages: Message[] = [];
let mountController: AbortController | null = null;
let unsubscribeLang: (() => void) | null = null;

export async function mountGuestbook() {
  // Defensive: if previously mounted without unmount, clean up first.
  if (mountController) unmountGuestbook();

  mountController = new AbortController();
  const { signal } = mountController;

  buildOverlay(signal);

  await loadAll(signal);
  if (signal.aborted) return;

  renderAll();

  // Re-render on language toggle for the lifetime of this mount.
  const langListener = () => {
    if (signal.aborted) return;
    renderAll();
  };
  onLangChange(langListener);
  unsubscribeLang = () => {
    // i18n.ts doesn't expose an unsubscribe today, so rely on the aborted
    // signal inside the callback. Keep this as a hook for future cleanup.
  };
}

export function unmountGuestbook() {
  if (mountController) {
    mountController.abort();
    mountController = null;
  }
  if (unsubscribeLang) {
    unsubscribeLang();
    unsubscribeLang = null;
  }

  const overlay = document.getElementById("guestbook-overlay");
  if (overlay) {
    overlay.innerHTML = "";
    overlay.style.display = "";
    overlay.style.opacity = "";
    overlay.style.transition = "";
  }

  publicMessages = [];
  myMessages = [];
  me = { user: null, isAdmin: false };
}

function buildOverlay(signal: AbortSignal) {
  const overlay = document.getElementById("guestbook-overlay")!;
  overlay.innerHTML = `
    <header class="gb-head">
      <h2 class="gb-title"></h2>
      <p class="gb-subtitle"></p>
    </header>
    <section class="gb-section" id="gb-wall">
      <div class="gb-section-label"></div>
      <div class="gb-list" id="gb-public-list"></div>
    </section>
    <section class="gb-section" id="gb-mine-section" hidden>
      <div class="gb-section-label"></div>
      <div class="gb-list" id="gb-mine-list"></div>
    </section>
    <section class="gb-section" id="gb-compose-section"></section>
  `;
  overlay.style.display = "block";
  overlay.style.opacity = "0";
  requestAnimationFrame(() => {
    if (signal.aborted) return;
    overlay.style.transition = "opacity 0.5s ease";
    overlay.style.opacity = "1";
  });

  // Outside-click closes any open admin menu. Scoped to this mount via signal.
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".gb-menu")) closeAllMenus();
    },
    { signal },
  );
}

async function loadAll(signal: AbortSignal) {
  try {
    const meRes = await client.api.fetch("/api/public/me", { signal });
    me = (await meRes.json()) as MeResponse;
  } catch {
    me = { user: null, isAdmin: false };
  }
  if (signal.aborted) return;

  const listUrl = me.isAdmin ? "/api/messages/admin" : "/api/public/messages";
  try {
    const res = await client.api.fetch(listUrl, { signal });
    const data = (await res.json()) as { messages: Message[] };
    publicMessages = data.messages || [];
  } catch {
    publicMessages = [];
  }
  if (signal.aborted) return;

  if (me.user && !me.isAdmin) {
    try {
      const res = await client.api.fetch("/api/messages/mine", { signal });
      const data = (await res.json()) as { messages: Message[] };
      myMessages = data.messages || [];
    } catch {
      myMessages = [];
    }
  } else {
    myMessages = [];
  }
}

async function reload() {
  if (!mountController || mountController.signal.aborted) return;
  await loadAll(mountController.signal);
  if (mountController?.signal.aborted) return;
  renderAll();
}

function renderAll() {
  const titleEl = document.querySelector<HTMLElement>(".gb-title");
  const subtitleEl = document.querySelector<HTMLElement>(".gb-subtitle");
  if (!titleEl || !subtitleEl) return;
  titleEl.textContent = t("boardTitle");
  subtitleEl.textContent = t("boardSubtitle");

  const wallLabel = document.querySelector<HTMLElement>("#gb-wall .gb-section-label");
  if (wallLabel) wallLabel.textContent = t("boardWall");

  const mineLabel = document.querySelector<HTMLElement>("#gb-mine-section .gb-section-label");
  if (mineLabel) mineLabel.textContent = t("boardMine");

  renderPublicList();
  renderMineSection();
  renderComposeSection();
}

function renderPublicList() {
  const el = document.getElementById("gb-public-list");
  if (!el) return;
  if (publicMessages.length === 0) {
    el.innerHTML = `<div class="gb-empty">${t("boardEmpty")}</div>`;
    return;
  }
  el.innerHTML = publicMessages.map((m) => renderCard(m, { context: "public" })).join("");
  bindCard(el, "public");
}

function renderMineSection() {
  const section = document.getElementById("gb-mine-section");
  if (!section) return;
  if (!me.user || me.isAdmin || myMessages.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const el = document.getElementById("gb-mine-list");
  if (!el) return;
  el.innerHTML = myMessages.map((m) => renderCard(m, { context: "mine" })).join("");
  bindCard(el, "mine");
}

function renderComposeSection() {
  const section = document.getElementById("gb-compose-section");
  if (!section) return;
  if (!me.user) {
    section.innerHTML = `<div class="gb-hint">${t("boardLoginHint")}</div>`;
    return;
  }
  if (me.isAdmin) {
    section.innerHTML = "";
    return;
  }
  if (myMessages.length > 0) {
    section.innerHTML = `<div class="gb-hint">${t("boardAlreadyPosted")}</div>`;
    return;
  }
  section.innerHTML = `
    <form class="gb-compose" id="gb-form">
      <textarea id="gb-input" maxlength="500" rows="3" placeholder="${escapeAttr(t("boardPlaceholder"))}"></textarea>
      <div class="gb-compose-footer">
        <span class="gb-char-count" id="gb-char-count">0/500</span>
        <button type="submit" class="gb-btn gb-btn-primary" id="gb-submit">${t("boardSend")}</button>
      </div>
    </form>
  `;
  const form = document.getElementById("gb-form") as HTMLFormElement;
  const input = document.getElementById("gb-input") as HTMLTextAreaElement;
  const charCount = document.getElementById("gb-char-count")!;
  const signal = mountController?.signal;
  input.addEventListener("input", () => {
    const len = input.value.length;
    charCount.textContent = `${len}/500`;
    charCount.classList.toggle("gb-char-warn", len > 450);
  }, signal ? { signal } : undefined);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  }, signal ? { signal } : undefined);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    const submit = document.getElementById("gb-submit") as HTMLButtonElement;
    submit.disabled = true;
    try {
      const res = await client.api.fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal,
      });
      if (res.status === 409) {
        await reload();
        return;
      }
      if (!res.ok) throw new Error("post failed");
      input.value = "";
      await reload();
    } catch {
      submit.disabled = false;
    }
  }, signal ? { signal } : undefined);
}

interface CardCtx {
  context: "public" | "mine";
}

function renderCard(m: Message, ctx: CardCtx): string {
  const hiddenBadge =
    m.visible === 0 ? `<span class="gb-badge">${t("boardHiddenBadge")}</span>` : "";
  const adminMenu = me.isAdmin ? renderAdminMenu(m) : "";
  const ownDelete =
    ctx.context === "mine" && !me.isAdmin
      ? `<button class="gb-icon-btn" data-action="own-delete" data-id="${m.id}" title="${escapeAttr(t("boardDeleteOwn"))}">✕</button>`
      : "";
  const replyBlock = renderReplyBlock(m);
  const likes = renderLikes(m);
  return `
    <article class="gb-card ${m.visible === 0 ? "gb-card-hidden" : ""}" data-id="${m.id}">
      <header class="gb-card-head">
        <div class="gb-card-author">
          <span class="gb-card-name">${escapeHtml(m.user_name)}</span>
          <span class="gb-card-time">${formatTime(m.created_at)}</span>
          ${hiddenBadge}
        </div>
        <div class="gb-card-actions">
          ${ownDelete}
          ${adminMenu}
        </div>
      </header>
      <div class="gb-card-body">${escapeHtml(m.content)}</div>
      ${replyBlock}
      ${likes}
    </article>
  `;
}

function renderReplyBlock(m: Message): string {
  const hasReply = !!m.admin_reply;
  const adminControls = me.isAdmin
    ? `
      <div class="gb-reply-edit" id="gb-reply-edit-${m.id}" hidden>
        <textarea class="gb-reply-input" maxlength="500" rows="2" placeholder="${escapeAttr(t("boardReplyPlaceholder"))}">${escapeHtml(m.admin_reply || "")}</textarea>
        <div class="gb-reply-edit-actions">
          <button class="gb-btn gb-btn-ghost" data-action="reply-cancel" data-id="${m.id}">✕</button>
          ${hasReply ? `<button class="gb-btn gb-btn-ghost" data-action="reply-remove" data-id="${m.id}">${t("boardReplyRemove")}</button>` : ""}
          <button class="gb-btn gb-btn-primary gb-btn-sm" data-action="reply-save" data-id="${m.id}">${t("boardReplySave")}</button>
        </div>
      </div>
    `
    : "";
  if (!hasReply && !me.isAdmin) return "";
  const display = hasReply
    ? `
      <div class="gb-reply" id="gb-reply-view-${m.id}">
        <div class="gb-reply-head">
          <span class="gb-reply-label">${t("boardReplyLabel")}</span>
          ${m.admin_reply_at ? `<span class="gb-reply-time">${formatTime(m.admin_reply_at)}</span>` : ""}
          ${me.isAdmin ? `<button class="gb-link" data-action="reply-open" data-id="${m.id}">${t("boardReply")}</button>` : ""}
        </div>
        <div class="gb-reply-body">${escapeHtml(m.admin_reply!)}</div>
      </div>
    `
    : `<button class="gb-link gb-reply-trigger" data-action="reply-open" data-id="${m.id}">+ ${t("boardReply")}</button>`;
  return display + adminControls;
}

function renderLikes(m: Message): string {
  const disabled = !me.user ? "disabled-until-login" : "";
  return `
    <div class="gb-likes">
      <button class="gb-like-btn ${m.has_liked ? "liked" : ""} ${disabled}" data-action="like" data-id="${m.id}" aria-pressed="${m.has_liked}">
        <span class="gb-like-heart">♥</span>
        <span class="gb-like-count">${m.like_count}</span>
      </button>
    </div>
  `;
}

function renderAdminMenu(m: Message): string {
  const visible = m.visible !== 0;
  return `
    <div class="gb-menu">
      <button class="gb-icon-btn" data-action="menu-toggle" aria-label="actions">⋯</button>
      <div class="gb-menu-dropdown" hidden>
        <button class="gb-menu-item" data-action="reply-open" data-id="${m.id}">${m.admin_reply ? t("boardReply") : "+ " + t("boardReply")}</button>
        <button class="gb-menu-item" data-action="visibility" data-id="${m.id}" data-visible="${visible ? 1 : 0}">${visible ? t("boardHide") : t("boardShow")}</button>
        <button class="gb-menu-item gb-menu-danger" data-action="admin-delete" data-id="${m.id}">${t("boardDelete")}</button>
      </div>
    </div>
  `;
}

function bindCard(container: HTMLElement, context: "public" | "mine") {
  const signal = mountController?.signal;
  container.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
    btn.addEventListener(
      "click",
      (e) => handleAction(btn, e, context),
      signal ? { signal } : undefined,
    );
  });
}

async function handleAction(btn: HTMLButtonElement, e: Event, context: "public" | "mine") {
  e.stopPropagation();
  const action = btn.dataset.action!;
  const id = btn.dataset.id ? parseInt(btn.dataset.id, 10) : NaN;
  const signal = mountController?.signal;

  switch (action) {
    case "menu-toggle": {
      closeAllMenus(btn.parentElement!);
      const dropdown = btn.nextElementSibling as HTMLElement | null;
      if (dropdown) dropdown.hidden = !dropdown.hidden;
      break;
    }
    case "visibility": {
      const current = parseInt(btn.dataset.visible!, 10);
      await client.api.fetch(`/api/messages/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: current ? 0 : 1 }),
        signal,
      });
      await reload();
      break;
    }
    case "admin-delete":
    case "own-delete": {
      if (!confirm(t("boardConfirmDelete"))) return;
      await client.api.fetch(`/api/messages/${id}`, { method: "DELETE", signal });
      await reload();
      break;
    }
    case "reply-open": {
      const view = document.getElementById(`gb-reply-view-${id}`);
      const edit = document.getElementById(`gb-reply-edit-${id}`);
      const trigger = document.querySelector<HTMLElement>(`[data-action="reply-open"][data-id="${id}"]`);
      if (view) view.hidden = true;
      if (edit) edit.hidden = false;
      if (trigger?.classList.contains("gb-reply-trigger")) trigger.hidden = true;
      const textarea = edit?.querySelector<HTMLTextAreaElement>(".gb-reply-input");
      textarea?.focus();
      closeAllMenus();
      break;
    }
    case "reply-cancel": {
      const edit = document.getElementById(`gb-reply-edit-${id}`);
      const view = document.getElementById(`gb-reply-view-${id}`);
      const trigger = document.querySelector<HTMLElement>(`.gb-reply-trigger[data-id="${id}"]`);
      if (edit) edit.hidden = true;
      if (view) view.hidden = false;
      if (trigger) trigger.hidden = false;
      break;
    }
    case "reply-save": {
      const edit = document.getElementById(`gb-reply-edit-${id}`);
      const input = edit?.querySelector<HTMLTextAreaElement>(".gb-reply-input");
      const reply = (input?.value || "").trim();
      await client.api.fetch(`/api/messages/${id}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: reply || null }),
        signal,
      });
      await reload();
      break;
    }
    case "reply-remove": {
      await client.api.fetch(`/api/messages/${id}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: null }),
        signal,
      });
      await reload();
      break;
    }
    case "like": {
      if (!me.user) {
        const signInBtn = document.querySelector<HTMLElement>('.nav-signin[data-i18n="signin"]');
        signInBtn?.click();
        return;
      }
      const msg = findMessage(id, context);
      if (!msg) return;
      const wasLiked = msg.has_liked;
      msg.has_liked = !wasLiked;
      msg.like_count = Math.max(0, msg.like_count + (wasLiked ? -1 : 1));
      updateLikeUI(btn, msg);
      try {
        const res = await client.api.fetch(`/api/messages/${id}/like`, {
          method: wasLiked ? "DELETE" : "POST",
          signal,
        });
        const data = (await res.json()) as { like_count: number; has_liked: boolean };
        msg.like_count = data.like_count;
        msg.has_liked = data.has_liked;
        updateLikeUI(btn, msg);
      } catch {
        msg.has_liked = wasLiked;
        msg.like_count = Math.max(0, msg.like_count + (wasLiked ? 1 : -1));
        updateLikeUI(btn, msg);
      }
      break;
    }
  }
}

function updateLikeUI(btn: HTMLButtonElement, msg: Message) {
  btn.classList.toggle("liked", msg.has_liked);
  btn.setAttribute("aria-pressed", String(msg.has_liked));
  const countEl = btn.querySelector(".gb-like-count");
  if (countEl) countEl.textContent = String(msg.like_count);
}

function findMessage(id: number, context: "public" | "mine"): Message | undefined {
  if (context === "mine") {
    return myMessages.find((m) => m.id === id) || publicMessages.find((m) => m.id === id);
  }
  return publicMessages.find((m) => m.id === id) || myMessages.find((m) => m.id === id);
}

function closeAllMenus(except?: HTMLElement) {
  document.querySelectorAll<HTMLElement>(".gb-menu-dropdown").forEach((el) => {
    if (except && except.contains(el)) return;
    el.hidden = true;
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "Z");
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

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;");
}
