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
  let finished = false;
  let lastTime = 0;
  let feedbackUntil = 0;
  let resultTimer: ReturnType<typeof setTimeout> | undefined;

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
  pauseButton.disabled = false;
  pauseButton.textContent = "Ⅱ";
  pauseButton.setAttribute("aria-label", "Pause game");
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
    const heading = overlay.querySelector("h2");
    if (heading) {
      heading.id = "ride-dialog-title";
      overlay.querySelector("[role=dialog]")!.setAttribute("aria-labelledby", heading.id);
    }
    controls.inert = true;
    overlay.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  };

  const togglePause = () => {
    if (finished) return;
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
    finish: (result: Result) => {
      finished = true;
      pauseButton.disabled = true;
      controls.inert = true;
      feedback.classList.remove("visible");
      const ride = result.ride;
      const content = `
        <div class="eyebrow">RIDE COMPLETE</div>
        <h2>${result.message.startsWith("Splash!") ? "Into the drink!" : "Keep it going?"}</h2>
        <p>${result.message}</p>
        <div class="result-score">${result.score.toLocaleString()} <span>points · ${result.correct} ${result.correct === 1 ? "boost" : "boosts"}</span></div>
        ${ride ? `<div class="ride-result-grid">
          <div><span>Distance</span><strong>${Math.floor(ride.distance).toLocaleString()} <small>m</small></strong></div>
          <div><span>Longest train</span><strong>${ride.longestTrain} <small>coaches</small></strong></div>
          <div><span>Best jump</span><strong>${ride.bestJump ? `${ride.bestJump.toFixed(1)} <small>m</small>` : "—"}</strong></div>
          <div><span>Top speed</span><strong>${Math.round(ride.peakSpeed * 3.6)} <small>km/h</small></strong></div>
        </div>
        <p class="ride-record${ride.newDistanceRecord || ride.newScoreRecord ? " is-new" : ""}">${ride.newDistanceRecord ? "New distance record!" : ride.newScoreRecord ? "New score record!" : `Best run · ${Math.floor(ride.bestDistance).toLocaleString()} m`}${ride.bestStreak >= 2 ? ` · ${ride.bestStreak} answers in a row` : ""}</p>` : ""}
        <button class="primary-button full-button" data-overlay="restart">Ride again →</button>`;
      // Keep the splash visible briefly; input is already locked and effects continue.
      resultTimer = setTimeout(() => { if (!disposed) showOverlay(content); }, result.message.startsWith("Splash!") ? 850 : 200);
    },
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
    if (action && !paused && !finished) {
      unlockAudio();
      game?.action(action);
      if (event.detail > 0) canvas.focus({ preventScroll: true });
    }
  }, options);

  canvas.addEventListener("pointerdown", (event) => {
    if (paused || finished) return;
    const rect = canvas.getBoundingClientRect();
    game?.pointer?.(
      ((event.clientX - rect.left) / rect.width) * W,
      ((event.clientY - rect.top) / rect.height) * H,
    );
  }, options);

  pauseButton.addEventListener("click", togglePause, options);
  document.querySelector("#restart-game")!.addEventListener("click", restart, options);

  window.addEventListener("keydown", (event) => {
    if (!overlay.hidden && event.key === "Tab") {
      const buttons = [...overlay.querySelectorAll<HTMLButtonElement>("button")];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (buttons.length) {
        event.preventDefault();
        buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      }
      return;
    }
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
    if (event.repeat) return;
    if (["Enter", " "].includes(event.key) && event.target instanceof HTMLElement && event.target.closest("button, a")) return;
    if (event.key === "Escape" || event.key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (paused || finished) return;
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
    clearTimeout(resultTimer);
    controller.abort();
    cancelAnimationFrame(raf);
    game?.destroy?.();
  };
}
