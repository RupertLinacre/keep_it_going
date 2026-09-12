import type { MiniKind } from "./mini-track";
import type { JumpApproach } from "./mini-guide";

const text = (element: HTMLElement, value: string) => {
  if (element.textContent !== value) element.textContent = value;
};

/** Screen-space labels stay crisp and proportional as the railway resizes. */
export class MiniReadouts {
  private readonly element = document.createElement("div");
  private readonly run: HTMLElement;
  private readonly title: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly score: HTMLElement;
  private readonly streak: HTMLElement;
  private readonly feature: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly value: HTMLElement;
  private readonly detail: HTMLElement;

  constructor(stage: HTMLElement) {
    this.element.className = "mini-readouts";
    this.element.innerHTML = `
      <div class="mini-run">
        <div class="mini-score-line"><p><strong class="mini-score">0</strong><span> pts</span></p><span class="mini-streak"></span></div>
        <p class="mini-run-title"></p>
        <p class="mini-run-summary"></p>
      </div>
      <div class="mini-feature">
        <span class="mini-feature-kicker"></span>
        <strong class="mini-feature-value"></strong>
        <span class="mini-feature-detail"></span>
      </div>`;
    this.run = this.element.querySelector<HTMLElement>(".mini-run")!;
    this.title = this.element.querySelector<HTMLElement>(".mini-run-title")!;
    this.summary = this.element.querySelector<HTMLElement>(".mini-run-summary")!;
    this.score = this.element.querySelector<HTMLElement>(".mini-score")!;
    this.streak = this.element.querySelector<HTMLElement>(".mini-streak")!;
    this.feature = this.element.querySelector<HTMLElement>(".mini-feature")!;
    this.kicker = this.element.querySelector<HTMLElement>(".mini-feature-kicker")!;
    this.value = this.element.querySelector<HTMLElement>(".mini-feature-value")!;
    this.detail = this.element.querySelector<HTMLElement>(".mini-feature-detail")!;
    stage.append(this.element);
  }

  render(state: {
    held: boolean;
    incoming: boolean;
    jump?: { distance: number; landed: boolean; record: boolean };
    approach?: JumpApproach;
    correct: number;
    score: number;
    streak: number;
    personalBest: number;
    distance: number;
    stalling: boolean;
    cargo: number;
    refillIn?: number;
    stress: number;
    feature: MiniKind;
    boost: number | null;
  }) {
    text(this.score, state.score.toLocaleString());
    text(this.streak, state.streak >= 2 ? `${state.streak} in a row` : "");
    text(this.title, state.held ? "RIDE COMPLETE"
      : state.stalling ? "LOSING MOMENTUM · SOLVE TO BOOST"
      : state.stress > 0.7 ? "TENSION RISING · HOLD BOOSTS"
      : state.incoming ? "A COACH IS CATCHING UP"
      : state.refillIn !== undefined ? `FRESH CARGO IN ${state.refillIn.toFixed(1)} s`
      : state.personalBest > 0 ? state.distance > state.personalBest
        ? `NEW BEST RUN · ${Math.floor(state.distance)} m`
        : `BEST RUN · ${Math.floor(state.personalBest)} m`
      : "KEEP THE LITTLE TRAIN ROLLING");
    text(this.summary, `${state.correct} ${state.correct === 1 ? "boost" : "boosts"} · ${state.cargo} parcels aboard`);
    this.run.classList.toggle("under-strain", !state.held && state.stress > 0.7);
    this.run.classList.toggle("needs-boost", !state.held && state.stalling);

    let kicker = "", value = "", detail = "", tone = "neutral";
    if (state.jump && !state.held) {
      kicker = state.jump.landed ? state.jump.record ? "NEW BEST JUMP" : "JUMP CLEARED" : "AIRTIME";
      value = `${state.jump.distance.toFixed(1)} m`;
      detail = state.jump.landed ? `+${Math.round(state.jump.distance * 10)} bonus points` : "Keep it flying";
      tone = "ready";
    } else if (state.stalling && !state.held) {
      kicker = "RUNNING OUT OF MOMENTUM";
      value = "Boost to keep rolling";
      detail = "Solve the question to keep rolling";
      tone = "warning";
    } else if (state.approach && !state.held) {
      kicker = `WATER JUMP · ${Math.ceil(state.approach.distance)} m AHEAD`;
      value = state.approach.ready ? "Ready to jump" : "Give it a boost";
      detail = state.approach.ready ? "Enough speed to clear the water" : "Build speed before the ramp";
      tone = state.approach.ready ? "ready" : "warning";
    } else if (state.boost !== null && !state.held) {
      value = `+${state.boost} km/h · BOOST`;
      tone = "ready";
    } else {
      value = state.feature === "firsthill" ? "FIRST DROP"
        : state.feature === "skyhill" ? "SKY-HIGH CLIMB"
        : state.feature === "triplehelix" ? "HELTER SKELTER · 3 TURNS"
        : state.feature === "invertedhill" ? "INVERTED CREST"
        : state.feature === "verticalhill" ? "VERTICAL CLIMB"
        : state.feature === "jump" ? "WATER JUMP" : state.feature.toUpperCase();
    }
    text(this.kicker, kicker); text(this.value, value); text(this.detail, detail);
    this.feature.dataset.tone = tone;
    this.feature.classList.toggle("has-detail", !!detail);
    this.feature.classList.toggle("jump-metric", !!state.jump && !state.held);
  }

  destroy() { this.element.remove(); }
}
