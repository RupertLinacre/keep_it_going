import "@fontsource/outfit/latin-400.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/outfit/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
import { courseSeed, freshCourseSeed } from "./games/course-seed";
import { mountGame } from "./runner";
import type { Difficulty } from "./types";
import { mountStart } from "./start";
import { unlockAudio } from "./audio";
import type { RaceSession } from "./multiplayer/session";
import type { Round } from "./multiplayer/protocol";

const app = document.querySelector<HTMLDivElement>("#app")!;
const query = new URLSearchParams(location.search);
let remixMode = query.get("mode") === "remix" || (query.get("mode") !== "classic" && !query.has("join"));
let cleanup: (() => void) | undefined;
let session: RaceSession | undefined;
let disconnectStart: (() => void) | undefined;

function syncFullscreen() {
  const button = app.querySelector<HTMLButtonElement>("[data-fullscreen]");
  if (!button) return;
  const active = !!document.fullscreenElement;
  const label = active ? "Exit fullscreen" : "Enter fullscreen";
  button.disabled = !document.fullscreenEnabled;
  button.title = button.disabled ? "This browser does not support fullscreen" : label;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(active));
  button.querySelector("path")?.setAttribute("d", active
    ? "M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"
    : "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5");
}
document.addEventListener("fullscreenchange", syncFullscreen);

function shell(playing: boolean) {
  cleanup?.(); cleanup = undefined;
  app.classList.toggle("at-start", !playing);
  app.classList.toggle("remix-root", remixMode);
  window.scrollTo(0, 0);
  app.innerHTML = `
    <div class="tiny-utility container">
      <button class="logo-home" data-menu aria-label="Game home" title="Back to start screen"><img class="game-logo" src="${import.meta.env.BASE_URL}images/keep-it-going-logo.png" alt="Keep it going" width="2172" height="724" /></button>
      <a class="track-gallery-link" href="${import.meta.env.BASE_URL}tracks.html">Track gallery ↗</a>
      <button class="text-button fullscreen-button" data-fullscreen aria-label="Enter fullscreen" title="Enter fullscreen" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path data-fullscreen-icon d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
      </button>
    </div><main id="main-content"></main>`;
  app.querySelector("[data-menu]")?.addEventListener("click", menu);
  app.querySelector("[data-fullscreen]")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      syncFullscreen();
    } catch {
      const button = app.querySelector<HTMLButtonElement>("[data-fullscreen]");
      if (button) button.title = "Fullscreen unavailable. Try opening the game in your browser.";
    }
  });
  syncFullscreen();
  return app.querySelector<HTMLElement>("#main-content")!;
}
function solo(tables: number[], difficulty: Difficulty, seedText = "") {
  unlockAudio();
  const seed = remixMode ? courseSeed(seedText) ?? freshCourseSeed() : undefined;
  cleanup = mountGame(shell(true), difficulty, () => solo(tables, difficulty, seedText), { tables, menu, remixMode, seed });
}
function race(round: Round) {
  unlockAudio();
  remixMode = round.mode === "remix";
  const url = new URL(location.href); url.searchParams.set("mode", remixMode ? "remix" : "classic");
  history.replaceState(null, "", url);
  cleanup = mountGame(shell(true), session?.role === "guest" ? round.guestDifficulty : round.difficulty, () => {}, { tables: round.tables, network: session, round, menu, remixMode });
}
function menu() {
  if (app.querySelector(".standalone-game")) {
    const url = new URL(location.href); url.searchParams.delete("join");
    history.replaceState(null, "", url);
  }
  disconnectStart?.(); disconnectStart = undefined;
  session?.close(); session = undefined;
  cleanup = mountStart(shell(false), solo, connected => {
    disconnectStart?.();
    session = connected;
    disconnectStart = session.on("prepare", race);
  }, remixMode);
}
window.addEventListener("pagehide", () => session?.close());
menu();
