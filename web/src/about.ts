import { ProjectData } from "./data";
import { getCurrentLang, onLangChange } from "./i18n";
import aboutData from "./about-data.json";

/** Virtual project entry for the about scene's planet (moon texture, purple glow) */
export const aboutProject: ProjectData = {
  id: "about",
  title: "About",
  date: "",
  shortDesc: { en: "", cn: "" },
  description: { en: "", cn: "" },
  githubUrl: "https://github.com/Younginspace",
  order: 99,
  glowColor: "#B39DDB",
  texture: "/textures/moon.jpg",
};

let overlayEl: HTMLElement;

export function initAbout() {
  overlayEl = document.getElementById("about-overlay")!;
  renderAbout();
  onLangChange(() => renderAbout());
}

function renderAbout() {
  const lang = getCurrentLang() as "en" | "cn";

  const careerHtml = aboutData.career
    .map(
      (c: { year: string; label: Record<string, string> }) => `
    <div class="career-item">
      <span class="career-year">${c.year}</span>
      <span class="career-label">${c.label[lang]}</span>
    </div>`,
    )
    .join("");

  const traitsHtml = aboutData.traits
    .map((t: { label: Record<string, string> }) => `<span class="trait-badge">${t.label[lang]}</span>`)
    .join("");

  overlayEl.innerHTML = `
    <h2 class="about-name">${aboutData.name}</h2>
    <p class="about-subtitle">${(aboutData.title as Record<string, string>)[lang]}</p>
    <p class="about-bio">${(aboutData.bio as Record<string, string>)[lang]}</p>
    <div class="about-divider"></div>
    <div class="about-career">${careerHtml}</div>
    <div class="about-traits">${traitsHtml}</div>
    <p class="about-aspiration">"${(aboutData.aspiration as Record<string, string>)[lang]}"</p>
    <a class="about-link" href="${aboutData.github}" target="_blank" rel="noopener noreferrer">GitHub &rarr;</a>
  `;
}

export function showAbout() {
  renderAbout();
  overlayEl.style.display = "block";
  overlayEl.style.opacity = "0";
  requestAnimationFrame(() => {
    overlayEl.style.transition = "opacity 0.6s ease";
    overlayEl.style.opacity = "1";
  });
}

export function hideAbout() {
  if (!overlayEl) return;
  overlayEl.style.transition = "opacity 0.3s ease";
  overlayEl.style.opacity = "0";
  setTimeout(() => {
    overlayEl.style.display = "none";
  }, 300);
}
