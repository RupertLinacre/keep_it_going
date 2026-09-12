import { save } from "./storage";
let context: AudioContext | undefined;
export function unlockAudio() {
  if (save.muted) return;
  try {
    context ||= new AudioContext();
    void context.resume();
  } catch {
    /* Sound is optional. */
  }
}
export function sound(kind: "good" | "bad" | "jump" | "beat" | "win") {
  if (save.muted || !context) return;
  const notes =
    kind === "win"
      ? [523, 659, 784, 1046]
      : kind === "good"
        ? [523, 784]
        : kind === "bad"
          ? [170, 120]
          : kind === "jump"
            ? [440, 660]
            : [330];
  notes.forEach((frequency, i) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    oscillator.type = kind === "bad" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    const start = context!.currentTime + i * 0.075;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.055, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    oscillator.connect(gain);
    gain.connect(context!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  });
}
