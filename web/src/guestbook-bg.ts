/**
 * Guestbook video background — replaces the Three.js scene.
 * Seamless looping video of a retro control room with
 * a radio telescope rotating outside the window.
 */
export function initGuestbookBackground(): () => void {
  // Hide the Three.js canvas (still used by home page)
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (canvas) canvas.style.display = "none";

  // Create looping video
  const video = document.createElement("video");
  video.id = "guestbook-video-bg";
  video.className = "guestbook-video-bg";
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.poster = "/video/guestbook-poster.jpg";
  video.preload = "auto";

  const srcWebm = document.createElement("source");
  srcWebm.src = "/video/guestbook-loop.webm";
  srcWebm.type = "video/webm";

  const srcMp4 = document.createElement("source");
  srcMp4.src = "/video/guestbook-loop.mp4";
  srcMp4.type = "video/mp4";

  video.appendChild(srcWebm);
  video.appendChild(srcMp4);

  document.body.insertBefore(video, document.body.firstChild);

  // Attempt autoplay — fall back to poster
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      video.style.display = "none";
      document.body.style.backgroundImage = "url(/video/guestbook-poster.jpg)";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
    });
  }

  return () => {
    video.pause();
    video.remove();
    if (canvas) canvas.style.display = "";
    document.body.style.backgroundImage = "";
  };
}
