import { POWERUPS, POWER_DURATION, type RidePowerups } from "./ride-powerups";

export class PowerupHud {
  readonly element = document.createElement("div");
  constructor(stage: HTMLElement) {
    this.element.className = "power-hud";
    this.element.innerHTML = '<span class="power-icon" aria-hidden="true"></span><div class="power-copy"><small></small><strong></strong><p></p></div><b class="power-time"></b><div class="power-meter"><i></i></div>';
    this.element.querySelector("strong")!.setAttribute("aria-live", "polite");
    stage.append(this.element);
  }
  render(power: RidePowerups, distance: number) {
    const kind = power.active ?? power.gate?.kind, info = kind ? POWERUPS[kind] : undefined;
    this.element.dataset.active = String(!!power.active);
    this.element.dataset.power = kind ?? "none";
    this.element.style.setProperty("--power-color", info?.color ?? "#648778");
    const write = (selector: string, value: string) => {
      const el = this.element.querySelector(selector)!;
      if (el.textContent !== value) el.textContent = value;
    };
    write(".power-icon", info?.icon ?? "✦");
    write("small", power.active ? "POWER-UP ACTIVE" : power.gate ? "THROUGH THE GATE" : "KEEP ROLLING");
    write("strong", info?.name ?? "Another surprise ahead");
    write("p", power.active ? info!.instruction : "Collect the ring on the track");
    write(".power-time", power.active ? `${Math.ceil(power.remaining)}s` : power.gate ? `${Math.max(0, Math.ceil(power.gate.distance - distance))}m` : "");
    (this.element.querySelector("i") as HTMLElement).style.transform = `scaleX(${power.active ? power.remaining/POWER_DURATION : 0})`;
  }
  destroy() { this.element.remove(); }
}
