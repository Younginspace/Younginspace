import "./index.css";

if (window.location.pathname === "/guestbook") {
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
    const sceneApi = initScene(canvas);
    initI18n();
    initAuthModal();
    setupSignInButton();
    updateHeaderForUser();

    // About nav link → jump to about scene
    const aboutLink = document.querySelector<HTMLElement>('[data-i18n="about"]');
    aboutLink?.addEventListener("click", (e) => {
      e.preventDefault();
      sceneApi.jumpToAbout();
    });
  });
}
