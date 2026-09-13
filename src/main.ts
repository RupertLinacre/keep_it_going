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

function shell(playing: boolean, seed?: number) {
  cleanup?.(); cleanup = undefined;
  app.classList.toggle("at-start", !playing);
  app.classList.toggle("remix-root", remixMode);
  window.scrollTo(0, 0);
  app.innerHTML = `
    <div class="tiny-utility container">
      <img class="game-logo" src="${import.meta.env.BASE_URL}images/keep-it-going-logo.png" alt="Keep it going" width="2172" height="724" />
      ${playing ? `<button class="text-button menu-link" data-menu>Start screen</button>` : ""}
      ${playing && remixMode ? `<button class="text-button seed-copy" data-copy-seed aria-label="Copy a link to this course"><b aria-hidden="true">⧉</b><span>Copy ride</span></button>` : ""}
      <a class="track-gallery-link" href="${import.meta.env.BASE_URL}tracks.html">Track gallery ↗</a>
    </div><main id="main-content"></main>`;
  app.querySelector("[data-menu]")?.addEventListener("click", menu);
  app.querySelector("[data-copy-seed]")?.addEventListener("click", async event => {
    const link = new URL(location.href); link.search = ""; link.searchParams.set("mode", "remix"); link.searchParams.set("seed", String(seed));
    const button = event.currentTarget as HTMLElement;
    try { await navigator.clipboard.writeText(link.href); button.setAttribute("aria-label", "Course link copied"); button.querySelector("span")!.textContent = "Copied!"; }
    catch { button.querySelector("span")!.textContent = `Seed ${seed}`; }
  });
  return app.querySelector<HTMLElement>("#main-content")!;
}
function solo(tables: number[], difficulty: Difficulty, seedText = "") {
  unlockAudio();
  const seed = remixMode ? courseSeed(seedText) ?? freshCourseSeed() : undefined;
  cleanup = mountGame(shell(true, seed), difficulty, () => solo(tables, difficulty, seedText), { tables, menu, remixMode, seed });
}
function race(round: Round) {
  unlockAudio();
  remixMode = round.mode === "remix";
  const url = new URL(location.href); url.searchParams.set("mode", remixMode ? "remix" : "classic");
  history.replaceState(null, "", url);
  cleanup = mountGame(shell(true, round.seed), session?.role === "guest" ? round.guestDifficulty : round.difficulty, () => {}, { tables: round.tables, network: session, round, menu, remixMode });
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
