import "./index.css";
import { initI18n } from "./i18n";
import { initAuthModal, setupSignInButton, updateHeaderForUser } from "./auth-modal";
import { initMessageBoard, setupBoardButton } from "./message-board";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// Shared initialization
initI18n();
initAuthModal();
setupSignInButton();
updateHeaderForUser();
initMessageBoard();
setupBoardButton();

const path = window.location.pathname;

if (path === "/about") {
  // About page: standalone scene
  import("./about-scene").then(({ initAboutScene }) => {
    initAboutScene(canvas);
  });
} else {
  // Main page: full scene with scroll navigation
  import("./scene").then(({ initScene }) => {
    initScene(canvas);
  });

  // About nav link → navigate to /about
  const aboutLink = document.querySelector<HTMLElement>('[data-i18n="about"]');
  aboutLink?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/about";
  });
}
