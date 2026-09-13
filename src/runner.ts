import { riderColor } from "./multiplayer/identity";
import { sound, unlockAudio } from "./audio";
import { H, W } from "./draw";
import { Mini } from "./games/mini";
import type { Difficulty, Host, Result } from "./types";
import type { RaceSession } from "./multiplayer/session";
import type { Round } from "./multiplayer/protocol";
import { raceWinner } from "./multiplayer/protocol";
import { OpponentGhost, snapshotRide } from "./multiplayer/ghost";

export function mountGame(
  root: HTMLElement,
  difficulty: Difficulty,
  restart: () => void,
  settings: { tables?: number[]; network?: RaceSession; round?: Round; menu?: () => void } = {},
): () => void {
  const controller = new AbortController();
  let disposed = false;
  let raf = 0;
  let game: Mini | undefined;
  const network = settings.network;
  if (network) {
    root.style.setProperty("--rider-color", riderColor(network.role));
    root.style.setProperty("--opponent-color", riderColor(network.role, true));
  }
  const ghost = network ? new OpponentGhost() : undefined;
  const subscriptions: (() => void)[] = [];
  let countdown = Infinity;
  let sendAt = 0, seq = 0, raceHudAt = 0;
  let overlayState = "";
  let wasSharedPause = false;
  let paused = false;
  let finished = false;
  let lastTime = 0;
  let feedbackUntil = 0;
  let resultTimer: ReturnType<typeof setTimeout> | undefined;

  root.innerHTML = `
    <div class="game-page container standalone-game">
      <div class="play-zone${network ? " is-race" : ""}">
        <div class="game-stage" style="--game-color:#d6e8d9">
          <canvas class="game-canvas" width="${W}" height="${H}" aria-label="Keep it going game world"></canvas>
          <div class="game-hud"></div>
          ${network ? `<div class="race-hud"><span class="race-rider"><i class="rider-dot"></i><span>You <strong data-your-distance>0 m</strong></span></span><span class="race-gap" data-race-gap>Keep it going!</span><span class="race-rider"><i class="rider-dot opponent"></i><span><span data-opponent-name></span> <strong data-rival-distance>0 m</strong></span></span></div>` : ""}
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
  const options = { signal: controller.signal };
  let lastStats = "";
  const safe = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const blocked = () => network ? network.phase !== "racing" || network.localPaused || network.remotePaused : paused;
  if (network) root.querySelector("[data-opponent-name]")!.textContent = network.opponent;

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
    overlay.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  };

  const togglePause = () => {
    if (network) { network.pause(!network.localPaused); return; }
    if (finished) return;
    paused = !paused;
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
      if (network) {
        controls.inert = true;
        controls.innerHTML = `<div class="prompt race-waiting"><h2>Your train ${result.message.startsWith("Splash!") ? "splashed down" : "stopped"}.</h2><p>${Math.floor(result.ride?.distance ?? 0).toLocaleString()} m travelled · Waiting for ${safe(network.opponent)} to finish.</p></div>`;
        // Send the final pose before the result so the other rider sees the stop.
        if (game) network.sendState(snapshotRide(game, ++seq));
        network.finish({ distance: result.ride?.distance ?? 0, correct: result.correct, score: result.score, water: result.message.startsWith("Splash!") });
        return;
      }
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
      if (network && finished) return;
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

  const syncRaceOverlay = () => {
    if (!network) return;
    const sharedPause = network.localPaused || network.remotePaused;
    if (sharedPause && !wasSharedPause && game) network.sendState(snapshotRide(game, ++seq));
    wasSharedPause = sharedPause;
    let key = "", content = "";
    if (network.phase === "error") {
      key = "error";
      content = `<div class="eyebrow">RACE INTERRUPTED</div><h2>We lost the connection.</h2><p>${safe(network.status)}</p><button class="primary-button full-button" data-overlay="menu">Back to start →</button>`;
    } else if (network.phase === "complete" && network.localResult && network.remoteResult) {
      key = `complete:${network.localRematch}:${network.remoteRematch}:${network.connected}`;
      const winner = raceWinner(network.localResult, network.remoteResult);
      content = `<div class="eyebrow">RACE COMPLETE</div><h2>${winner === "draw" ? "A perfect tie!" : winner === "local" ? "You went further!" : `${safe(network.opponent)} went further!`}</h2>
        <p>Every answer kept you rolling.</p><div class="race-results"><div><i class="rider-dot"></i><span>You</span><strong>${network.localResult.distance.toFixed(1)} <small>m</small></strong><small>${network.localResult.correct} boosts</small></div><div><i class="rider-dot opponent"></i><span>${safe(network.opponent)}</span><strong>${network.remoteResult.distance.toFixed(1)} <small>m</small></strong><small>${network.remoteResult.correct} boosts</small></div></div>
        <button class="primary-button full-button" data-overlay="rematch" ${network.localRematch || !network.connected ? "disabled" : ""}>${!network.connected ? "Your friend left the ride" : network.localRematch ? "Waiting for your friend…" : "Race again →"}</button>
        ${network.connected && network.remoteRematch && !network.localRematch ? `<p>Your friend is ready for another ride.</p>` : ""}<button class="text-button" data-overlay="menu">Back to start</button>`;
    } else if (network.localPaused || network.remotePaused) {
      key = `pause:${network.localPaused}:${network.remotePaused}`;
      content = `<div class="eyebrow">BOTH TRAINS PAUSED</div><h2>${network.localPaused ? "Take a breather." : `${safe(network.opponent)} paused.`}</h2><p>The race continues when you’re both ready.</p>
        ${network.localPaused ? `<button class="primary-button full-button" data-overlay="resume">I’m ready →</button>` : ""}<button class="text-button" data-overlay="menu">Leave race</button>`;
    } else if (network.phase === "preparing" || network.phase === "countdown") {
      key = `countdown:${network.phase}:${Math.ceil(countdown)}`;
      content = `<div class="eyebrow">${network.phase === "preparing" ? "BUILDING YOUR TRACKS" : "READY TO ROLL"}</div><h2 class="race-countdown">${network.phase === "preparing" ? "All aboard…" : Math.max(1, Math.ceil(countdown))}</h2><p>Answer to boost. Go further than your friend.</p><button class="text-button" data-overlay="menu">Leave race</button>`;
    }
    if (key === overlayState) return;
    overlayState = key;
    if (key) showOverlay(content);
    else { hideOverlay(); controls.inert = finished; canvas.focus({ preventScroll: true }); }
  };
  if (network) {
    subscriptions.push(network.on("change", syncRaceOverlay), network.on("state", state => ghost!.push(state)),
      network.on("go", at => {
        countdown = Math.max(0, (at - performance.now()) / 1000);
        if (document.hidden) network.pause(true);
        syncRaceOverlay();
      }));
  }

  try {
    game = new Mini(host, settings.round?.seed, { tables: settings.tables, questionSeed: settings.round?.questionSeed, multiplayer: !!network, riderRole: network?.role });
    game.opponent = ghost;
    if (network) { ghost!.push(snapshotRide(game, 0)); syncRaceOverlay(); network.ready(); }
    const frame = (now: number) => {
      if (disposed) return;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
      lastTime = now;
      if (network?.phase === "countdown" && !network.localPaused && !network.remotePaused) {
        countdown -= dt;
        if (countdown <= 0) network.begin();
        syncRaceOverlay();
      }
      if (!blocked()) game!.update(dt);
      if (network && now >= sendAt && network.phase === "racing" && !network.localPaused && !network.remotePaused) {
        network.sendState(snapshotRide(game!, ++seq)); sendAt = now + 1000 / 12;
      }
      if (network && now >= raceHudAt) {
        raceHudAt = now + 100;
        const local = Math.max(0, game!.travelled);
        const remote = network.remoteResult?.distance ?? Math.max(0, (ghost!.latest?.distance ?? game!.track.startDistance) - game!.track.startDistance);
        root.querySelector("[data-your-distance]")!.textContent = `${Math.floor(local).toLocaleString()} m`;
        root.querySelector("[data-rival-distance]")!.textContent = `${Math.floor(remote).toLocaleString()} m`;
        const gap = Math.round(local - remote);
        root.querySelector("[data-race-gap]")!.textContent = network.remoteResult ? "Your friend has finished" : finished ? "Your ride is complete" : Math.abs(gap) < 2 ? "Neck and neck" : `${Math.abs(gap)} m ${gap > 0 ? "ahead" : "behind"}`;
      }
      ctx.clearRect(0, 0, W, H);
      game!.draw(ctx);
      if (now > feedbackUntil) feedback.classList.remove("visible");
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    showOverlay(`<h2>The ride couldn’t load.</h2><p>Refresh the page to give it another try.</p><button class="primary-button full-button" data-overlay="menu">Back to start</button>`);
  }

  overlay.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-overlay]")?.dataset.overlay;
    if (action === "resume") togglePause();
    if (action === "restart") restart();
    if (action === "menu") settings.menu?.();
    if (action === "rematch") network?.rematch();
  }, options);

  controls.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action && !blocked() && !finished) {
      unlockAudio();
      game?.action(action);
      if (event.detail > 0) canvas.focus({ preventScroll: true });
    }
  }, options);

  window.addEventListener("keydown", (event) => {
    if (!overlay.hidden && event.key === "Tab") {
      const buttons = [...overlay.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
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
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (blocked() || finished) return;
    if (event.key === "Escape") {
      event.preventDefault();
      game?.key("Escape");
      canvas.focus({ preventScroll: true });
      return;
    }
    if (/^[0-9c]$/i.test(event.key) || ["Enter", "Backspace"].includes(event.key)) {
      event.preventDefault();
      unlockAudio();
      game?.key(event.key);
    }
  }, options);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (network) network.pause(true);
      else if (!paused) togglePause();
    }
  }, options);

  return () => {
    disposed = true;
    clearTimeout(resultTimer);
    controller.abort();
    subscriptions.forEach(off => off());
    cancelAnimationFrame(raf);
    game?.destroy?.();
  };
}
