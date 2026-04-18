const translations: Record<string, Record<string, string>> = {
  en: {
    about: "About",
    blog: "Blog",
    guestbookNav: "Guestbook",
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
    boardTitle: "Guestbook",
    boardSubtitle: "Leave a note, it reaches further than you think.",
    boardSend: "Send",
    boardPlaceholder: "Write something…",
    boardLoginHint: "Sign in to leave a message",
    boardEmpty: "No messages yet.",
    boardJustNow: "just now",
    boardWall: "Wall",
    boardMine: "Your message",
    boardReply: "Reply",
    boardReplyLabel: "Author reply",
    boardReplySave: "Save",
    boardReplyRemove: "Remove reply",
    boardReplyPlaceholder: "Write a reply…",
    boardLike: "Like",
    boardLiked: "Liked",
    boardAlreadyPosted: "You've already left a message. Delete it to post again.",
    boardDeleteOwn: "Delete",
    boardHiddenBadge: "Hidden",
    boardHide: "Hide",
    boardShow: "Show",
    boardDelete: "Delete",
    boardConfirmDelete: "Delete this message?",
  },
  cn: {
    about: "关于",
    blog: "博客",
    guestbookNav: "留言簿",
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
    boardTitle: "留言簿",
    boardSubtitle: "留下一句话，它会传得比你想象的更远。",
    boardSend: "发送",
    boardPlaceholder: "写点什么…",
    boardLoginHint: "登录后可留言",
    boardEmpty: "还没有留言。",
    boardJustNow: "刚刚",
    boardWall: "留言墙",
    boardMine: "你的留言",
    boardReply: "回复",
    boardReplyLabel: "作者回复",
    boardReplySave: "保存",
    boardReplyRemove: "撤回回复",
    boardReplyPlaceholder: "写下你的回复…",
    boardLike: "点赞",
    boardLiked: "已赞",
    boardAlreadyPosted: "你已留过言，删除后可再留。",
    boardDeleteOwn: "删除",
    boardHiddenBadge: "已隐藏",
    boardHide: "隐藏",
    boardShow: "显示",
    boardDelete: "删除",
    boardConfirmDelete: "确认删除这条留言？",
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
