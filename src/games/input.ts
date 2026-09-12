/** Shared touch keypad. Keyboard input is handled by the game shell. */
export function numberPad() {
  return `<div class="number-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "↵"].map((n) => `<button data-action="${n === "⌫" ? "back" : n === "↵" ? "submit" : `digit:${n}`}" ${n === "⌫" ? 'aria-label="Delete digit"' : n === "↵" ? 'aria-label="Submit answer"' : ""} class="${n === "↵" ? "enter-key" : ""}">${n}</button>`).join("")}</div>`;
}
