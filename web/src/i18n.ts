const translations: Record<string, Record<string, string>> = {
  en: {
    about: "About",
    blog: "Blog",
    signin: "Sign In",
    signout: "Sign Out",
    scrollHint: "Scroll to explore",
    spaceHint: "Press space to continue",
    cardLink: "GitHub →",
  },
  cn: {
    about: "关于",
    blog: "博客",
    signin: "登录",
    signout: "退出",
    scrollHint: "滚动探索",
    spaceHint: "按空格键继续",
    cardLink: "GitHub →",
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
