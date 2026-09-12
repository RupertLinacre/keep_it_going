import { sound, unlockAudio } from "./audio";
import { H, W } from "./draw";
import { Mini } from "./games/mini";
import type { Difficulty, Game, Host, Result } from "./types";

export function mountGame(
  root: HTMLElement,
  difficulty: Difficulty,
  restart: () => void,
): () => void {
  const controller = new AbortController();
  let disposed = false;
  let raf = 0;
  let game: Game | undefined;
  let paused = false;
  let lastTime = 0;
  let feedbackUntil = 0;

  root.innerHTML = `
    <div class="game-page container standalone-game">
      <div class="play-zone">
        <div class="game-stage" style="--game-color:#d6e8d9">
          <canvas class="game-canvas" width="${W}" height="${H}" aria-label="Keep it going game world"></canvas>
          <div class="game-hud"></div>
          <div class="game-feedback" role="status" aria-live="polite"></div>
        </div>
        <div class="play-controls"></div>
        <div class="game-overlay" hidden></div>
      </div>
    </div>`;

  const stage = root.querySelector<HTMLElement>(".game-stage")!;
  const canvas = root.querySelector<HTMLCanvasElement>(".game-canvas")!;
  const ctx = canvas.getContext("2d")!;
  const overlay = root.querySelector<HTMLElement>(".game-overlay")!;
  const controls = root.querySelector<HTMLElement>(".play-controls")!;
  const hud = root.querySelector<HTMLElement>(".game-hud")!;
  const feedback = root.querySelector<HTMLElement>(".game-feedback")!;
  const pauseButton = document.querySelector<HTMLButtonElement>("#pause-game")!;
  const options = { signal: controller.signal };
  let lastStats = "";

  canvas.tabIndex = 0;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const hideOverlay = () => {
    overlay.hidden = true;
    controls.inert = false;
  };

  const showOverlay = (content: string) => {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="overlay-card" role="dialog" aria-modal="true">${content}</div>`;
    controls.inert = true;
    overlay.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  };

  const togglePause = () => {
    paused = !paused;
    pauseButton.textContent = paused ? "▷" : "Ⅱ";
    pauseButton.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
    if (paused) {
      showOverlay(`
        <span class="overlay-symbol">Ⅱ</span>
        <div class="eyebrow">RIDE PAUSED</div>
        <h2>Take your time.</h2>
        <button class="primary-button full-button" data-overlay="resume">Keep riding →</button>
        <button class="text-button" data-overlay="restart">Start again</button>`);
    } else {
      hideOverlay();
      canvas.focus({ preventScroll: true });
    }
  };

  const host: Host = {
    stage,
    difficulty,
    sound,
    finish: (_result: Result) => {},
    panel: (html) => {
      const active =
        document.activeElement instanceof HTMLElement && controls.contains(document.activeElement)
          ? document.activeElement.dataset.action
          : undefined;
      controls.innerHTML = html;
      if (active) {
        const replacement = [...controls.querySelectorAll<HTMLButtonElement>("[data-action]")].find(
          (button) => button.dataset.action === active && !button.disabled,
        );
        (replacement || canvas).focus({ preventScroll: true });
      }
    },
    stats: (stats) => {
      const html = stats
        .map((stat) => `<div class="hud-stat"><span>${stat.label}</span><strong>${stat.value}</strong></div>`)
        .join("");
      if (html !== lastStats) {
        lastStats = html;
        hud.innerHTML = html;
      }
    },
    feedback: (message, positive = true) => {
      feedback.textContent = message;
      feedback.className = `game-feedback visible ${positive ? "" : "negative"}`;
      feedbackUntil = performance.now() + 3500;
    },
  };

  try {
    game = new Mini(host);
    unlockAudio();
    const frame = (now: number) => {
      if (disposed) return;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
      lastTime = now;
      if (!paused) game!.update(dt);
      ctx.clearRect(0, 0, W, H);
      game!.draw(ctx);
      if (now > feedbackUntil) feedback.classList.remove("visible");
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    showOverlay("<h2>The ride couldn’t load.</h2><p>Refresh the page to give it another try.</p>");
  }

  overlay.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-overlay]")?.dataset.overlay;
    if (action === "resume") togglePause();
    if (action === "restart") restart();
  }, options);

  controls.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action && !paused) {
      unlockAudio();
      game?.action(action);
      if (event.detail > 0) canvas.focus({ preventScroll: true });
    }
  }, options);

  canvas.addEventListener("pointerdown", (event) => {
    if (paused) return;
    const rect = canvas.getBoundingClientRect();
    game?.pointer?.(
      ((event.clientX - rect.left) / rect.width) * W,
      ((event.clientY - rect.top) / rect.height) * H,
    );
  }, options);

  pauseButton.addEventListener("click", togglePause, options);
  document.querySelector("#restart-game")!.addEventListener("click", restart, options);

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
    if (event.repeat) return;
    if (["Enter", " "].includes(event.key) && event.target instanceof HTMLElement && event.target.closest("button, a")) return;
    if (event.key === "Escape" || event.key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;
    if (/^[0-9c]$/i.test(event.key) || ["Enter", "Backspace"].includes(event.key)) {
      event.preventDefault();
      unlockAudio();
      game?.key(event.key);
    }
  }, options);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !paused) togglePause();
  }, options);

  return () => {
    disposed = true;
    controller.abort();
    cancelAnimationFrame(raf);
    game?.destroy?.();
  };
}
