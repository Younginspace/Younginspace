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
    startTitle: "A Journey Through Space",
    startBody: "Each planet is a story I built.\nScroll to Explore with me.",
    wipSuffix: "WIP",
    loadError: "Failed to load",
    statusVisible: "visible",
    statusHidden: "hidden",
    bootLine1: "> INITIALIZING COMM SYSTEM...",
    bootLine2: "> SCANNING FREQUENCIES...",
    bootLine3: "> SIGNAL LOCK: SPACECRAFT YOUNG",
    bootLine4: "> CONNECTION ESTABLISHED",
    boardTitle: "> MESSAGE TO SPACE",
    boardSend: "TRANSMIT",
    boardPlaceholder: "> enter message...",
    boardLoginHint: "> sign in to transmit",
    boardEmpty: "> no transmissions received",
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
    startTitle: "穿越星海的旅程",
    startBody: "每颗星球，都是我写下的故事。\n滚动鼠标，与我一同探索。",
    wipSuffix: "进行中",
    loadError: "加载失败",
    statusVisible: "可见",
    statusHidden: "隐藏",
    bootLine1: "> 通讯系统启动中...",
    bootLine2: "> 正在扫描频段...",
    bootLine3: "> 信号锁定：YOUNG 号飞船",
    bootLine4: "> 连接已建立",
    boardTitle: "> MESSAGE TO SPACE",
    boardSend: "发射",
    boardPlaceholder: "> 输入信号内容...",
    boardLoginHint: "> 登录后可发射信号",
    boardEmpty: "> 尚未收到任何信号",
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

  // All elements with data-i18n
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n!;
    if (tr[key]) el.textContent = tr[key];
  });
}
