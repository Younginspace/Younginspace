import "./index.css";
import { initScene } from "./scene";
import { initI18n } from "./i18n";
import { initAuthModal, setupSignInButton, updateHeaderForUser } from "./auth-modal";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
initScene(canvas);
initI18n();
initAuthModal();
setupSignInButton();
updateHeaderForUser();
