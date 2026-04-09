import gsap from "gsap";
// @ts-ignore — GSAP Observer.d.ts casing issue on case-sensitive FS
import { Observer } from "gsap/Observer";

gsap.registerPlugin(Observer);

export type InteractionMode = "travel" | "view";

export interface ScrollController {
  currentScene: number;
  isTransitioning: boolean;
  mode: InteractionMode;
  onSceneChange: ((direction: 1 | -1) => void) | null;
  onModeChange: ((mode: InteractionMode) => void) | null;
  setMode(mode: InteractionMode): void;
  destroy(): void;
}

export function createScrollController(totalScenes: number): ScrollController {
  const state: ScrollController = {
    currentScene: 0,
    isTransitioning: false,
    mode: "travel",
    onSceneChange: null,
    onModeChange: null,
    setMode(mode) {
      state.mode = mode;
      state.onModeChange?.(mode);
      updateHints();
    },
    destroy() {},
  };

  let lastTriggerTime = 0;
  const DEBOUNCE_MS = 150;

  // Scroll in travel mode → scene change
  // Scroll down = next scene, scroll up = previous scene
  const observer = Observer.create({
    type: "wheel,touch",
    onDown() {
      if (state.mode !== "travel") return;
      const now = Date.now();
      if (state.isTransitioning || now - lastTriggerTime < DEBOUNCE_MS) return;
      if (state.currentScene >= totalScenes - 1) return;
      lastTriggerTime = now;
      state.onSceneChange?.(1);
    },
    onUp() {
      if (state.mode !== "travel") return;
      const now = Date.now();
      if (state.isTransitioning || now - lastTriggerTime < DEBOUNCE_MS) return;
      if (state.currentScene <= 0) return;
      lastTriggerTime = now;
      state.onSceneChange?.(-1);
    },
    tolerance: 15,
    preventDefault: true,
  });

  // Mouse drag → enter view mode
  let isDragging = false;
  const canvas = document.getElementById("canvas")!;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 0 && state.mode === "travel" && !state.isTransitioning) {
      isDragging = true;
    }
  });
  canvas.addEventListener("pointermove", () => {
    if (isDragging && state.mode === "travel") {
      state.setMode("view");
      isDragging = false;
    }
  });
  canvas.addEventListener("pointerup", () => {
    isDragging = false;
  });

  // Space / Escape → return to travel mode
  window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "Escape") && state.mode === "view") {
      e.preventDefault();
      state.setMode("travel");
    }
  });

  function updateHints() {
    const scrollHint = document.getElementById("scroll-hint");
    const spaceHint = document.getElementById("space-hint");
    if (scrollHint) {
      scrollHint.style.display = state.mode === "travel" ? "block" : "none";
    }
    if (spaceHint) {
      spaceHint.style.display = state.mode === "view" ? "block" : "none";
    }
  }

  state.destroy = () => {
    observer.kill();
  };

  return state;
}
