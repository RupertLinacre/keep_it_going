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
import { unlockAudio } from "./audio";
import { mountGame } from "./runner";
import { persist, save } from "./storage";
import type { Difficulty } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;
let cleanup: (() => void) | undefined;

const soundIcon = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>${save.muted ? '<path d="m16 9 6 6m0-6-6 6"/>' : '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'}</svg>`;

function render() {
  cleanup?.();
  app.innerHTML = `
    <div class="tiny-utility container">
      <label class="tiny-pace" for="difficulty">
        <span>PACE</span>
        <select id="difficulty" aria-label="Difficulty">
          <option value="easy" ${save.difficulty === "easy" ? "selected" : ""}>Explorer</option>
          <option value="normal" ${save.difficulty === "normal" ? "selected" : ""}>Rider</option>
          <option value="hard" ${save.difficulty === "hard" ? "selected" : ""}>Rocket</option>
        </select>
      </label>
      <div class="tiny-utility-buttons">
        <button id="restart-game" class="icon-button" aria-label="Restart game" title="Restart">↻</button>
        <button id="pause-game" class="icon-button" aria-label="Pause game" title="Pause (P)">Ⅱ</button>
        <button id="sound-toggle" class="icon-button" aria-label="${save.muted ? "Turn sound on" : "Mute sound"}" aria-pressed="${!save.muted}" title="${save.muted ? "Turn sound on" : "Mute sound"}">${soundIcon()}</button>
      </div>
    </div>
    <main id="main-content"></main>`;

  app.querySelector<HTMLSelectElement>("#difficulty")!.addEventListener(
    "change",
    (event) => {
      save.difficulty = (event.target as HTMLSelectElement).value as Difficulty;
      persist();
      render();
    },
  );

  app.querySelector("#sound-toggle")!.addEventListener("click", () => {
    save.muted = !save.muted;
    persist();
    if (!save.muted) unlockAudio();
    const button = app.querySelector<HTMLButtonElement>("#sound-toggle")!;
    button.innerHTML = soundIcon();
    button.setAttribute("aria-label", save.muted ? "Turn sound on" : "Mute sound");
    button.setAttribute("aria-pressed", String(!save.muted));
  });

  cleanup = mountGame(
    app.querySelector<HTMLElement>("#main-content")!,
    save.difficulty,
    render,
  );
}

render();
