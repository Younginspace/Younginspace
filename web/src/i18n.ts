const translations: Record<string, Record<string, string>> = {
  en: {
    about: "About",
    blog: "Blog",
    guestbookFab: "Leave something behind :)",
    signin: "Sign In",
    signout: "Sign Out",
    scrollHint: "Scroll to explore",
    spaceHint: "Press space to continue",
    cardLink: "GitHub →",
    boardTitle: "Message Board",
    boardSend: "Send",
    boardPlaceholder: "Leave a message...",
    boardLoginHint: "Sign in to leave a message",
    boardEmpty: "No messages yet. Be the first!",
    boardJustNow: "just now",
    boardTabPublic: "Messages",
    boardTabAdmin: "Admin",
    boardHide: "Hide",
    boardShow: "Show",
    boardDelete: "Delete",
  },
  cn: {
    about: "关于",
    blog: "博客",
    guestbookFab: "留下点什么 :)",
    signin: "登录",
    signout: "退出",
    scrollHint: "滚动探索",
    spaceHint: "按空格键继续",
    cardLink: "GitHub →",
    boardTitle: "留言板",
    boardSend: "发送",
    boardPlaceholder: "留下你的留言...",
    boardLoginHint: "登录后即可留言",
    boardEmpty: "还没有留言，来做第一个吧！",
    boardJustNow: "刚刚",
    boardTabPublic: "留言",
    boardTabAdmin: "管理",
    boardHide: "隐藏",
    boardShow: "显示",
    boardDelete: "删除",
  },
};

let currentLang = "en";
type LangChangeCallback = (lang: string) => void;
const listeners: LangChangeCallback[] = [];

export function getCurrentLang() {
  return currentLang;
}

export function t(key: string): string {
  return translations[currentLang]?.[key] ?? key;
}

export function onLangChange(cb: LangChangeCallback) {
  listeners.push(cb);
}

export function initI18n() {
  const toggle = document.getElementById("lang-toggle")!;

  toggle.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "cn" : "en";
    toggle.textContent = currentLang.toUpperCase();
    applyTranslations();
    listeners.forEach((cb) => cb(currentLang));
  });
}

function applyTranslations() {
  const tr = translations[currentLang];

  // nav links & other elements with data-i18n
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n!;
    if (tr[key]) el.textContent = tr[key];
  });

  // back button
  const backBtn = document.getElementById("back-btn");
  if (backBtn) backBtn.textContent = tr.back;
}
