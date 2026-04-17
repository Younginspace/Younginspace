/**
 * Lightweight debug slider panel for tuning shader uniforms in-browser.
 * Zero deps; renders a fixed-position panel with labeled sliders.
 *
 * Usage:
 *   const panel = createDebugPanel({
 *     title: "Nebula",
 *     sliders: [
 *       { label: "Intensity", min: 0, max: 2, step: 0.01,
 *         get: () => mat.uniforms.uIntensity.value,
 *         set: (v) => { mat.uniforms.uIntensity.value = v; } },
 *       ...
 *     ],
 *   });
 */

export interface DebugSliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
}

export interface DebugPanelConfig {
  title: string;
  sliders: DebugSliderSpec[];
}

export function createDebugPanel(cfg: DebugPanelConfig) {
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed;
    top: 70px;
    right: 16px;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    min-width: 260px;
    backdrop-filter: blur(6px);
    user-select: none;
  `;

  const titleEl = document.createElement("div");
  titleEl.textContent = `▼ ${cfg.title}`;
  titleEl.style.cssText = `
    font-weight: 700;
    letter-spacing: 0.06em;
    padding-bottom: 8px;
    margin-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
  `;
  root.appendChild(titleEl);

  const body = document.createElement("div");
  root.appendChild(body);

  let collapsed = false;
  titleEl.addEventListener("click", () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "block";
    titleEl.textContent = `${collapsed ? "▶" : "▼"} ${cfg.title}`;
  });

  for (const s of cfg.sliders) {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 6px 0;";

    const labelEl = document.createElement("label");
    labelEl.textContent = s.label;
    labelEl.style.cssText = "flex: 0 0 80px; opacity: 0.8;";

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(s.get());
    input.style.cssText = "flex: 1; accent-color: #f0a860;";

    const valueEl = document.createElement("span");
    valueEl.textContent = Number(s.get()).toFixed(2);
    valueEl.style.cssText = "flex: 0 0 42px; text-align: right; opacity: 0.85; font-variant-numeric: tabular-nums;";

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      s.set(v);
      valueEl.textContent = v.toFixed(2);
    });

    row.appendChild(labelEl);
    row.appendChild(input);
    row.appendChild(valueEl);
    body.appendChild(row);
  }

  document.body.appendChild(root);

  return {
    root,
    destroy() {
      root.remove();
    },
  };
}
