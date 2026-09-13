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
import { save } from "./storage";

const app = document.querySelector<HTMLDivElement>("#app")!;
let cleanup: (() => void) | undefined;

function render() {
  cleanup?.();
  app.innerHTML = `
    <div class="tiny-utility container">
      <img class="game-logo" src="${import.meta.env.BASE_URL}images/keep-it-going-logo.png" alt="Keep it going" width="2172" height="724" />
      <a class="track-gallery-link" href="${import.meta.env.BASE_URL}tracks.html">Track gallery ↗</a>
    </div>
    <main id="main-content"></main>`;

  cleanup = mountGame(
    app.querySelector<HTMLElement>("#main-content")!,
    save.difficulty,
    render,
  );
}

render();
