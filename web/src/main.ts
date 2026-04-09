import "./index.css";
import { initScene } from "./scene";
import { initI18n } from "./i18n";
import { initAuthModal, setupSignInButton, updateHeaderForUser } from "./auth-modal";
import { initMessageBoard, setupBoardButton } from "./message-board";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const sceneApi = initScene(canvas);
initI18n();
initAuthModal();
setupSignInButton();
updateHeaderForUser();
initMessageBoard();
setupBoardButton();

// About nav link → jump to about scene
const aboutLink = document.querySelector<HTMLElement>('[data-i18n="about"]');
aboutLink?.addEventListener("click", (e) => {
  e.preventDefault();
  sceneApi.jumpToAbout();
});
