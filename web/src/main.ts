import "./index.css";
import { initScene } from "./scene";
import { initI18n } from "./i18n";
import { initAuthModal, setupSignInButton, updateHeaderForUser } from "./auth-modal";
import { initMessageBoard, setupBoardButton } from "./message-board";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
initScene(canvas);
initI18n();
initAuthModal();
setupSignInButton();
updateHeaderForUser();
initMessageBoard();
setupBoardButton();
