/**
 * Lightweight debug panel for tuning shader uniforms in-browser.
 * Zero deps; renders a fixed-position panel with labeled sliders + color pickers.
 *
 * Usage:
 *   const panel = createDebugPanel({
 *     title: "Nebula",
 *     sliders: [
 *       { label: "Intensity", min: 0, max: 2, step: 0.01,
 *         get: () => mat.uniforms.uIntensity.value,
 *         set: (v) => { mat.uniforms.uIntensity.value = v; } },
 *     ],
 *     colors: [
 *       { label: "Highlight",
 *         get: () => "#ff9c42",
 *         set: (hex) => { ... } },
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

export interface DebugColorSpec {
  label: string;
  /** Current color as `#rrggbb`. */
  get: () => string;
  /** Called with a new `#rrggbb` value on every change. */
  set: (hex: string) => void;
}

export interface DebugPanelConfig {
  title: string;
  sliders?: DebugSliderSpec[];
  colors?: DebugColorSpec[];
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
    min-width: 280px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
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

  const sliders = cfg.sliders ?? [];
  for (const s of sliders) {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 6px 0;";

    const labelEl = document.createElement("label");
    labelEl.textContent = s.label;
    labelEl.style.cssText = "flex: 0 0 90px; opacity: 0.8;";

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(s.get());
    input.style.cssText = "flex: 1; accent-color: #f0a860;";

    const valueEl = document.createElement("span");
    valueEl.textContent = Number(s.get()).toFixed(2);
    valueEl.style.cssText =
      "flex: 0 0 42px; text-align: right; opacity: 0.85; font-variant-numeric: tabular-nums;";

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

  const colors = cfg.colors ?? [];
  if (colors.length > 0) {
    const sep = document.createElement("div");
    sep.style.cssText =
      "margin: 10px 0 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; opacity: 0.55; letter-spacing: 0.1em; text-transform: uppercase;";
    sep.textContent = "Colors";
    body.appendChild(sep);
  }
  for (const c of colors) {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 6px 0;";

    const labelEl = document.createElement("label");
    labelEl.textContent = c.label;
    labelEl.style.cssText = "flex: 0 0 90px; opacity: 0.8;";

    const input = document.createElement("input");
    input.type = "color";
    input.value = c.get();
    input.style.cssText =
      "flex: 1; height: 22px; background: transparent; border: 1px solid rgba(255,255,255,0.18); border-radius: 3px; padding: 0 2px; cursor: pointer;";

    const valueEl = document.createElement("span");
    valueEl.textContent = c.get();
    valueEl.style.cssText =
      "flex: 0 0 70px; text-align: right; opacity: 0.7; font-variant-numeric: tabular-nums;";

    input.addEventListener("input", () => {
      const hex = input.value;
      c.set(hex);
      valueEl.textContent = hex;
    });

    row.appendChild(labelEl);
    row.appendChild(input);
    row.appendChild(valueEl);
    body.appendChild(row);
  }

  // Copy-to-clipboard footer: dump current values as TS for pasting
  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Copy values as code";
  exportBtn.style.cssText = `
    margin-top: 10px;
    width: 100%;
    padding: 5px 8px;
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    letter-spacing: 0.05em;
  `;
  exportBtn.addEventListener("mouseenter", () => {
    exportBtn.style.background = "rgba(255,255,255,0.14)";
  });
  exportBtn.addEventListener("mouseleave", () => {
    exportBtn.style.background = "rgba(255,255,255,0.08)";
  });
  exportBtn.addEventListener("click", async () => {
    const sliderLines = sliders.map(
      (s) => `  ${labelToKey(s.label)}: ${Number(s.get()).toFixed(2)},`,
    );
    const colorLines = colors.map(
      (c) => `  ${labelToKey(c.label)}: "${c.get()}",`,
    );
    const out = `// ${cfg.title}\n{\n${[...sliderLines, ...colorLines].join("\n")}\n}`;
    try {
      await navigator.clipboard.writeText(out);
      exportBtn.textContent = "✓ Copied";
      setTimeout(() => (exportBtn.textContent = "Copy values as code"), 1200);
    } catch {
      exportBtn.textContent = "✗ Copy failed (see console)";
      console.log(out);
      setTimeout(() => (exportBtn.textContent = "Copy values as code"), 1600);
    }
  });
  body.appendChild(exportBtn);

  document.body.appendChild(root);

  return {
    root,
    destroy() {
      root.remove();
    },
  };
}

function labelToKey(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}
