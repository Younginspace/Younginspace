import "./index.css";

if (window.location.pathname === "/guestbook") {
  // Guestbook standalone page
  import("./guestbook-page").then(({ initGuestbookPage }) => initGuestbookPage());
} else {
  // 3D homepage
  import("./scene").then(({ initScene }) => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    initScene(canvas);
  });
  import("./i18n").then(({ initI18n }) => initI18n());
  import("./auth-modal").then(({ initAuthModal, setupSignInButton, updateHeaderForUser }) => {
    initAuthModal();
    setupSignInButton();
    updateHeaderForUser();
  });
}
