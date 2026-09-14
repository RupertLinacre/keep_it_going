import { POWERUPS, POWER_DURATION, POWER_ANSWERS, type RidePowerups } from "./ride-powerups";

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
    write("small", power.active ? "POWER-UP ACTIVE" : power.gate ? "THROUGH THE GATE" : "EARN A POWER-UP");
    write("strong", info?.name ?? (power.answers >= POWER_ANSWERS ? "Next gate coming" : "Keep answering"));
    write("p", power.active ? info!.instruction : power.gate ? "Collect the ring on the track" : "Four correct answers unlock the next gate");
    write(".power-time", power.active ? `${Math.ceil(power.remaining)}s` : power.gate ? `${Math.max(0, Math.ceil(power.gate.distance - distance))}m` : `${power.answers}/${POWER_ANSWERS}`);
    (this.element.querySelector("i") as HTMLElement).style.transform = `scaleX(${power.active ? power.remaining/POWER_DURATION : power.answers/POWER_ANSWERS})`;
  }
  destroy() { this.element.remove(); }
}
