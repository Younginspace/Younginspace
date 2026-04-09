import "./index.css";

const path = window.location.pathname;

if (path === "/about") {
  // About standalone page
  import("./about-scene").then(({ initAboutScene }) => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    initAboutScene(canvas);
  });
  // Still need i18n + auth on about page
  Promise.all([
    import("./i18n"),
    import("./auth-modal"),
  ]).then(([{ initI18n }, { initAuthModal, setupSignInButton, updateHeaderForUser }]) => {
    initI18n();
    initAuthModal();
    setupSignInButton();
    updateHeaderForUser();
  });
} else if (path === "/guestbook") {
  // Guestbook standalone page
  import("./guestbook-page").then(({ initGuestbookPage }) => initGuestbookPage());
} else {
  // 3D homepage
  Promise.all([
    import("./scene"),
    import("./i18n"),
    import("./auth-modal"),
  ]).then(([{ initScene }, { initI18n }, { initAuthModal, setupSignInButton, updateHeaderForUser }]) => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    initScene(canvas);
    initI18n();
    initAuthModal();
    setupSignInButton();
    updateHeaderForUser();

    // About nav link → navigate to /about
    const aboutLink = document.querySelector<HTMLElement>('[data-i18n="about"]');
    aboutLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/about";
    });
  });
}
