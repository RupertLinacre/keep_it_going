import { POWERUPS, POWER_KINDS } from "./games/ride-powerups";
import { riderColor } from "./multiplayer/identity";
import { DIFFICULTIES, DIFFICULTY_LABELS, normalizeDifficulty } from "./difficulty";
import type { Difficulty } from "./types";
import { ALL_TABLES, DEFAULT_TABLES, normalizeTables } from "./questions";
import { RaceSession } from "./multiplayer/session";
import { cleanCode, validCode } from "./multiplayer/protocol";
import { courseSeed } from "./games/course-seed";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function readSettings(): { tables: number[]; name: string; difficulty: Difficulty } {
  try { const v = JSON.parse(localStorage.getItem("keep-going-setup") || "{}"); return { difficulty: normalizeDifficulty(v.difficulty), tables: normalizeTables(v.tables), name: typeof v.name === "string" ? v.name.slice(0, 18) : "" }; }
  catch { return { tables: [...DEFAULT_TABLES], name: "", difficulty: "normal" }; }
}

export function mountStart(root: HTMLElement, play: (tables: number[], difficulty: Difficulty, seed?: string) => void, connect: (session: RaceSession) => void, remixMode = false) {
  const controller = new AbortController();
  const settings = readSettings();
  const selected = new Set(settings.tables);
  const invite = cleanCode(new URL(location.href).searchParams.get("join") || "");
  let session: RaceSession | undefined;
  let off: (() => void) | undefined;
  let disposed = false;
  let setupRole: "host" | "guest" = "host";
  root.innerHTML = `
    <section class="start-screen container">
      <div class="start-card">
        <div data-choose>
          <h1>Your adventure starts here.</h1>
          <label class="setup-label" for="ride-difficulty">Difficulty</label>
          <select class="setup-input difficulty-select" id="ride-difficulty">${DIFFICULTIES.map(level => `<option value="${level}" ${settings.difficulty === level ? "selected" : ""}>${DIFFICULTY_LABELS[level]}</option>`).join("")}</select>
          <section class="table-settings" aria-labelledby="tables-heading"><h2 id="tables-heading">Choose your times tables</h2><span class="table-selection" data-table-summary></span>
            <p>Tap to choose. In a race, the host picks for both players.</p>
            <div class="table-chips" role="group" aria-label="Times tables">${ALL_TABLES.map(n => `<label><input type="checkbox" name="table" value="${n}" ${selected.has(n) ? "checked" : ""}><span>${n}×</span></label>`).join("")}</div>
            <div class="table-shortcuts"><button class="text-button" data-tables="default">Default · 2–12</button><button class="text-button" data-tables="all">All tables</button><button class="text-button" data-tables="easy">2, 5 & 10</button><button class="text-button" data-tables="clear">Clear</button></div>
            <p class="setup-error" data-table-error role="status"></p>
          </section>
          <div class="mode-buttons">
            <button class="mode-button mode-solo" data-single><span class="mode-number">1</span><span><strong>1 player</strong><small>Jump straight in</small></span><span aria-hidden="true">↗</span></button>
            <div class="multiplayer-choices" role="group" aria-label="2 players">
              <span class="multiplayer-label">2 players</span>
              <button class="mode-button mode-duo" data-join-choice><span><strong>Join a game</strong><small>Enter a friend’s code</small></span></button>
              <button class="mode-button mode-duo" data-two><span><strong>Create a game</strong><small>Invite a friend</small></span></button>
            </div>
          </div>
          ${remixMode ? `<details class="remix-settings"><summary>Course seed & ride surprises</summary>
            <label class="setup-label" for="course-seed">Course seed <span>(optional)</span></label>
            <input class="setup-input" id="course-seed" maxlength="40" placeholder="Leave blank for a fresh ride" value="${escape(new URL(location.href).searchParams.get("seed") || "")}">
            <p class="difficulty-help">Use the same seed to replay a course and its power-up order. Words work too.</p>
            <ul class="power-menu">${POWER_KINDS.map(kind => `<li><i style="--power-color:${POWERUPS[kind].color}">${POWERUPS[kind].icon}</i><span><strong>${POWERUPS[kind].name}</strong><small>${POWERUPS[kind].description}</small></span></li>`).join("")}</ul>
            <p class="difficulty-help">Earn power-ups with four correct answers between pickups. Each lasts 20 seconds. Races include six powers, including Sky lift, collected independently. Downhill drift is solo only. Cargo carnival allows eight boxes per wagon; red dynamite bursts after spilling.</p>
          </details>` : ""}
          <p class="start-footnote">${remixMode ? 'Correct answers boost automatically. <a href="?mode=classic">Play the original solo / two-player game →</a>' : 'A correct answer gives you a boost automatically. <a href="?mode=remix">Try the remix →</a>'}</p>
        </div>
        <div data-join-setup hidden>
          <button class="text-button back-button" data-back>← Back</button>
          <span class="start-kicker">2 PLAYERS</span><h2 data-setup-title>Create a game</h2>
          <p class="setup-copy">Two tracks. The same questions.<br>Whoever travels furthest wins.</p>
          ${remixMode ? '<p class="difficulty-help">Race on the same fresh course with six surprise powers. Sky lift raises your own track; Downhill drift stays in solo play.</p>' : ''}
          <label class="setup-label" for="multiplayer-difficulty">Your difficulty</label>
          <select class="setup-input difficulty-select" id="multiplayer-difficulty">${DIFFICULTIES.map(level => `<option value="${level}" ${settings.difficulty === level ? "selected" : ""}>${DIFFICULTY_LABELS[level]}</option>`).join("")}</select>
          <p class="difficulty-help">Choose a challenge that suits you. Your friend can choose a different level.</p>
          <label class="setup-label" for="rider-name">Your name <span>(optional)</span></label>
          <input class="setup-input" id="rider-name" maxlength="18" autocomplete="nickname" placeholder="Rider" value="${escape(settings.name)}">
          <button class="primary-button full-button create-invite" data-create>Create an invite →</button>
          <form data-join-form><label class="setup-label" for="invite-code">Their four-character code</label><div class="join-row"><input class="setup-input code-input" id="invite-code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${validCode(invite) ? invite : ""}"><button class="primary-button" type="submit">Join →</button></div></form>
          <p class="setup-error" data-join-error role="status"></p>
        </div>
        <div data-lobby hidden></div>
      </div>
    </section>`;
  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const persist = () => {
    settings.difficulty = normalizeDifficulty(q<HTMLSelectElement>("#ride-difficulty").value);
    settings.tables = [...selected].sort((a, b) => a - b);
    settings.name = q<HTMLInputElement>("#rider-name").value;
    try { localStorage.setItem("keep-going-setup", JSON.stringify(settings)); } catch {}
  };
  const updateTables = () => {
    q("[data-table-summary]").textContent = selected.size === 12 ? "All · 1–12" : selected.size ? [...selected].sort((a, b) => a - b).join(", ") : "Choose at least one";
    q<HTMLButtonElement>("[data-single]").disabled = !selected.size;
    q<HTMLButtonElement>("[data-create]").disabled = !selected.size;
    q<HTMLButtonElement>("[data-two]").disabled = !selected.size;
    q("[data-table-error]").textContent = selected.size ? "" : "Select at least one times table to start.";
    persist();
  };
  const show = (panel: "choose" | "join-setup" | "lobby") => {
    q(".start-screen").classList.toggle("showing-setup", panel !== "choose");
    for (const name of ["choose", "join-setup", "lobby"]) q(`[data-${name}]`).hidden = name !== panel;
  };
  const showSetup = (role: "host" | "guest") => {
    setupRole = role;
    q("[data-setup-title]").textContent = role === "host" ? "Create a game" : "Join a game";
    q("[data-create]").hidden = role !== "host";
    q("[data-join-form]").hidden = role !== "guest";
    q("[data-join-error]").textContent = "";
    show("join-setup");
    if (role === "guest") q("#invite-code").focus();
  };
  const renderLobby = () => {
    if (!session || disposed) return;
    const host = session.role === "host";
    const ready = session.phase === "ready";
    const error = session.phase === "error";
    const inviteReady = host && ["waiting", "ready"].includes(session.phase);
    q("[data-lobby]").style.setProperty("--rider-color", riderColor(session.role));
    q("[data-lobby]").style.setProperty("--opponent-color", riderColor(session.role, true));
    q("[data-lobby]").innerHTML = `
      <button class="text-button back-button" data-lobby-back>← ${error ? "Try again" : "Leave lobby"}</button>
      <span class="start-kicker">${error ? "LET’S TRY THAT AGAIN" : ready ? "TWO RIDERS, READY" : "YOUR PRIVATE RIDE"}</span>
      <h2>${error ? "Couldn’t connect" : host ? "Here’s your invite" : ready ? "Ready to race" : "Joining your friend"}</h2>
      ${!error && host ? `<p class="setup-copy">Ask your friend to choose <strong>Join a game</strong><br>and enter this code on their device.</p><div class="invite-code" aria-label="Invite code">${inviteReady ? session.code : "····"}</div><div class="invite-actions"><button class="text-button" data-copy="code" ${inviteReady ? "" : "disabled"}>Copy code</button><button class="text-button" data-copy="link" ${inviteReady ? "" : "disabled"}>Copy invite link</button></div>` : ""}
      <p class="lobby-status ${error ? "is-error" : ""}" role="status">${escape(session.status)}</p>
      ${!error ? `<p class="lobby-mode">${session.remixMode ? "Remix race · six powers · shared course" : "Classic race"}</p>` : ""}
      ${error || new URL(location.href).searchParams.has("network") ? `<p class="difficulty-help">Connection: ${escape(session.network.stage)} · ${escape(session.network.route)} · relay ${escape(session.network.relay)}</p><button class="text-button" data-copy-diagnostics>Copy connection details</button>` : ""}
      ${ready ? `<div class="lobby-riders"><span><i class="rider-dot"></i>${escape(session.name)} <small>(you) · ${DIFFICULTY_LABELS[session.difficulty]}</small></span><span><i class="rider-dot opponent"></i>${escape(session.opponent)} <small>${DIFFICULTY_LABELS[session.opponentDifficulty]}</small></span></div>` : ""}
      ${!error && (host || ready) ? `<section class="shared-tables" data-shared-tables><h3>Times tables for both players</h3><div>${session.tables.map(n => `<span>${n}×</span>`).join("")}</div><p>${host ? "Your selection applies to both riders." : "Chosen by your friend. You’ll both practise these tables."}</p></section>` : ""}
      ${host && !error ? `<button class="primary-button full-button" data-start-race ${ready ? "" : "disabled"}>${ready ? "Start the race →" : "Waiting for your friend…"}</button>` : ""}
      <p class="copy-status" data-copy-status role="status"></p>`;
  };
  const open = (role: "host" | "guest") => {
    persist();
    const code = cleanCode(q<HTMLInputElement>("#invite-code").value);
    if (role === "guest" && !validCode(code)) {
      q("[data-join-error]").textContent = "Enter the four-character code from your friend.";
      q("#invite-code").focus(); return;
    }
    off?.(); session?.close();
    session = new RaceSession(); connect(session);
    off = session.on("change", renderLobby);
    show("lobby");
    void session.open(role, settings.name, [...selected], code, settings.difficulty,
      { remixMode, seed: role === "host" && remixMode ? courseSeed(q<HTMLInputElement>("#course-seed").value) : undefined });
  };
  root.addEventListener("change", event => {
    const input = event.target as HTMLInputElement;
    if (["ride-difficulty", "multiplayer-difficulty"].includes(input.id)) {
      const level = normalizeDifficulty(input.value);
      q<HTMLSelectElement>("#ride-difficulty").value = level;
      q<HTMLSelectElement>("#multiplayer-difficulty").value = level;
      persist(); return;
    }
    if (input.name !== "table") return;
    input.checked ? selected.add(Number(input.value)) : selected.delete(Number(input.value));
    updateTables();
  }, { signal: controller.signal });
  root.addEventListener("click", async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    if (button.hasAttribute("data-single")) { persist(); play([...selected], settings.difficulty, remixMode ? q<HTMLInputElement>("#course-seed").value : undefined); }
    if (button.hasAttribute("data-two")) showSetup("host");
    if (button.hasAttribute("data-join-choice")) showSetup("guest");
    if (button.hasAttribute("data-back")) show("choose");
    if (button.hasAttribute("data-lobby-back")) { off?.(); session?.close(); showSetup(setupRole); }
    if (button.dataset.tables) {
      selected.clear();
      const values = button.dataset.tables === "default" ? DEFAULT_TABLES : button.dataset.tables === "all" ? ALL_TABLES : button.dataset.tables === "easy" ? [2, 5, 10] : [];
      values.forEach(n => selected.add(n));
      root.querySelectorAll<HTMLInputElement>('[name="table"]').forEach(input => { input.checked = selected.has(Number(input.value)); });
      updateTables();
    }
    if (button.hasAttribute("data-create")) open("host");
    if (button.hasAttribute("data-start-race")) session?.start();
    if (button.hasAttribute("data-copy-diagnostics") && session) {
      try { await navigator.clipboard.writeText(JSON.stringify(session.diagnostics(), null, 2)); q("[data-copy-status]").textContent = "Connection details copied."; }
      catch { q("[data-copy-status]").textContent = JSON.stringify(session.diagnostics()); }
    }
    if (button.dataset.copy && session) {
      const url = new URL(location.href); url.search = ""; url.hash = ""; url.searchParams.set("join", session.code);
      url.searchParams.set("mode", session.remixMode ? "remix" : "classic");
      if (session.network.mode !== "auto") url.searchParams.set("network", session.network.mode);
      try {
        await navigator.clipboard.writeText(button.dataset.copy === "link" ? url.href : session.code);
        if (!disposed) q("[data-copy-status]").textContent = "Copied! Send it to your friend.";
      } catch { if (!disposed) q("[data-copy-status]").textContent = `Your code is ${session.code}. Share it with your friend.`; }
    }
  }, { signal: controller.signal });
  q("[data-join-form]").addEventListener("submit", event => { event.preventDefault(); open("guest"); }, { signal: controller.signal });
  updateTables();
  if (validCode(invite)) showSetup("guest");
  return () => { disposed = true; controller.abort(); off?.(); };
}
