import { ProjectData } from "./data";
import { getCurrentLang, onLangChange, t } from "./i18n";

/**
 * Flat HTML overlay for project info — replaces sphere text shell.
 * No background box, just floating text.
 */

let infoEl: HTMLElement;
let titleEl: HTMLElement;
let descEl: HTMLElement;
let linkEl: HTMLAnchorElement;
let liveLinkEl: HTMLAnchorElement;
let currentProject: ProjectData | null = null;

export function initProjectInfo() {
  infoEl = document.getElementById("project-info")!;
  titleEl = document.getElementById("project-title")!;
  descEl = document.getElementById("project-desc")!;
  linkEl = document.getElementById("project-link") as HTMLAnchorElement;
  liveLinkEl = document.getElementById("project-live-link") as HTMLAnchorElement;

  onLangChange(() => {
    if (currentProject && infoEl.style.display !== "none") {
      const lang = getCurrentLang() as "en" | "cn";
      descEl.textContent = currentProject.shortDesc[lang];
      // Re-render live link suffix in new language
      if (currentProject.liveUrl) {
        const host = currentProject.liveUrl.replace(/^https?:\/\//, "");
        liveLinkEl.textContent = currentProject.liveWip
          ? `${host} (${t("wipSuffix")}) →`
          : `${host} →`;
      }
    }
  });
}

export function showProjectInfo(project: ProjectData) {
  currentProject = project;
  const lang = getCurrentLang() as "en" | "cn";
  titleEl.textContent = `${project.title}  ${project.date}`;
  descEl.textContent = project.shortDesc[lang];
  linkEl.href = project.githubUrl;
  linkEl.style.color = project.glowColor;

  // Live URL link (optional)
  if (project.liveUrl) {
    const host = project.liveUrl.replace(/^https?:\/\//, "");
    liveLinkEl.href = project.liveUrl;
    liveLinkEl.textContent = project.liveWip
      ? `${host} (${t("wipSuffix")}) →`
      : `${host} →`;
    liveLinkEl.style.color = project.glowColor;
    liveLinkEl.style.display = "inline-block";
  } else {
    liveLinkEl.style.display = "none";
  }

  infoEl.style.display = "block";
  infoEl.style.opacity = "0";
  requestAnimationFrame(() => {
    infoEl.style.transition = "opacity 0.5s ease";
    infoEl.style.opacity = "1";
  });
}

export function hideProjectInfo() {
  if (!infoEl) return;
  currentProject = null;
  infoEl.style.transition = "opacity 0.3s ease";
  infoEl.style.opacity = "0";
  setTimeout(() => {
    infoEl.style.display = "none";
  }, 300);
}
