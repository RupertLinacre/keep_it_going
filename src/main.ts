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
import { mountGame } from "./runner";
import type { Difficulty } from "./types";
import { mountStart } from "./start";
import { unlockAudio } from "./audio";
import type { RaceSession } from "./multiplayer/session";
import type { Round } from "./multiplayer/protocol";

const app = document.querySelector<HTMLDivElement>("#app")!;
const query = new URLSearchParams(location.search);
const heightMode = query.get("mode") !== "classic" && !query.has("join");
let cleanup: (() => void) | undefined;
let session: RaceSession | undefined;
let disconnectStart: (() => void) | undefined;

function shell(playing: boolean) {
  cleanup?.(); cleanup = undefined;
  app.classList.toggle("at-start", !playing);
  window.scrollTo(0, 0);
  app.innerHTML = `
    <div class="tiny-utility container">
      <img class="game-logo" src="${import.meta.env.BASE_URL}images/keep-it-going-logo.png" alt="Keep it going" width="2172" height="724" />
      ${playing ? `<button class="text-button menu-link" data-menu>Start screen</button>` : ""}
      <a class="track-gallery-link" href="${import.meta.env.BASE_URL}tracks.html">Track gallery ↗</a>
    </div><main id="main-content"></main>`;
  app.querySelector("[data-menu]")?.addEventListener("click", menu);
  return app.querySelector<HTMLElement>("#main-content")!;
}
function solo(tables: number[], difficulty: Difficulty) {
  unlockAudio();
  cleanup = mountGame(shell(true), difficulty, () => solo(tables, difficulty), { tables, menu, heightMode });
}
function race(round: Round) {
  unlockAudio();
  cleanup = mountGame(shell(true), session?.role === "guest" ? round.guestDifficulty : round.difficulty, () => {}, { tables: round.tables, network: session, round, menu });
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
  }, heightMode);
}
window.addEventListener("pagehide", () => session?.close());
menu();
