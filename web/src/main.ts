import "./index.css";
import gsap from "gsap";
import { initScene, type SceneMode } from "./scene";
import { initI18n } from "./i18n";
import { initAuthModal, setupSignInButton, updateHeaderForUser } from "./auth-modal";

/** Turn location (pathname + hash) into the scene mode + intro preference. */
function parseRoute(): { mode: SceneMode; skipIntro: boolean } {
  const p = location.pathname;
  const h = location.hash;
  if (p === "/guestbook") return { mode: "guestbook", skipIntro: true };
  if (p === "/" && h === "#about") return { mode: "about", skipIntro: true };
  return { mode: "home", skipIntro: false };
}

/** Fade out the pre-paint `.entering` blur once the scene is mounted. */
function playInitialEnterFade() {
  if (!document.documentElement.classList.contains("entering")) return;
  const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
  const warp = document.getElementById("warp-overlay");
  if (!canvas || !warp) {
    document.documentElement.classList.remove("entering");
    return;
  }
  canvas.style.filter = "blur(14px)";
  warp.style.opacity = "0.55";
  document.documentElement.classList.remove("entering");

  const proxy = { blur: 14, dim: 0.55 };
  gsap.to(proxy, {
    blur: 0,
    dim: 0,
    duration: 0.5,
    ease: "power2.out",
    onUpdate() {
      canvas.style.filter = proxy.blur < 0.3 ? "" : `blur(${proxy.blur}px)`;
      warp.style.opacity = proxy.dim < 0.01 ? "" : String(proxy.dim);
    },
    onComplete() {
      canvas.style.filter = "";
      warp.style.opacity = "";
    },
  });
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const scene = initScene(canvas);
initI18n();
initAuthModal();
setupSignInButton();
updateHeaderForUser();

// Initial mode based on URL (refresh / deep-link).
const initial = parseRoute();
scene.enterMode(initial.mode, { skipIntro: initial.skipIntro });

// Reveal body on the next animation frame (scene has painted its first frame
// by then). Then kick off the blur-in fade on the frame after, so the fade
// plays against a visible scene rather than a hidden body.
requestAnimationFrame(() => {
  document.documentElement.classList.remove("pre-fouc");
  requestAnimationFrame(() => playInitialEnterFade());
});

// --- SPA router: intercept internal nav clicks, push history, switch mode ---
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/")) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (e.button !== 0) return;
  if (e.defaultPrevented) return;
  if (a.hasAttribute("target") && a.getAttribute("target") !== "_self") return;

  const url = new URL(a.href, location.origin);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.hash === location.hash) return;

  e.preventDefault();
  history.pushState(null, "", url.pathname + url.search + url.hash);
  const next = parseRoute();
  scene.enterMode(next.mode, { skipIntro: next.skipIntro });
});

// Browser back/forward
window.addEventListener("popstate", () => {
  const next = parseRoute();
  scene.enterMode(next.mode, { skipIntro: next.skipIntro });
});
