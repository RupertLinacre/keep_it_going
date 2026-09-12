import type { MiniKind } from "./mini-track";

/** Screen-space labels stay crisp and proportional as the railway resizes. */
export class MiniReadouts {
  private readonly element = document.createElement("div");
  private readonly title: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly feature: HTMLElement;

  constructor(stage: HTMLElement) {
    this.element.className = "mini-readouts";
    this.element.innerHTML = `
      <div class="mini-run">
        <p class="mini-run-title"></p>
        <p class="mini-run-summary"></p>
      </div>
      <div class="mini-feature"></div>`;
    this.title = this.element.querySelector<HTMLElement>(".mini-run-title")!;
    this.summary = this.element.querySelector<HTMLElement>(".mini-run-summary")!;
    this.feature = this.element.querySelector<HTMLElement>(".mini-feature")!;
    stage.append(this.element);
  }

  render(state: {
    held: boolean;
    correct: number;
    bestRun: number;
    feature: MiniKind;
    boost: number | null;
  }) {
    const title = state.held
      ? "HELD · SOLVE TO ROLL AGAIN"
      : "KEEP THE LITTLE TRAIN ROLLING";
    const summary = `${state.correct} boosts · best run ${Math.floor(state.bestRun)} m`;
    const feature = state.boost !== null
      ? `+${state.boost} km/h · BOOST`
      : state.feature === "skyhill"
        ? "SKY-HIGH CLIMB"
        : state.feature === "triplehelix"
          ? "HELTER SKELTER · 3 TURNS"
        : state.feature === "invertedhill"
          ? "INVERTED CREST"
        : state.feature === "verticalhill"
          ? "VERTICAL CLIMB"
        : state.feature.toUpperCase();

    // The game draws every frame; only change DOM text when a value changes.
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.summary.textContent !== summary) this.summary.textContent = summary;
    if (this.feature.textContent !== feature) this.feature.textContent = feature;
    this.feature.classList.toggle("boosting", state.boost !== null);
  }

  destroy() {
    this.element.remove();
  }
}
