/** Presentation progress waits for settled critical assets, with a bounded escape. */
export function introProgress(elapsed, ready, reduced = false) {
  const minimum = reduced ? 300 : 3400;
  const deadline = reduced ? 650 : 5200;
  if ((ready && elapsed >= minimum) || elapsed >= deadline) return 100;
  const t = Math.max(0, Math.min(1, elapsed / minimum));
  return Math.max(1, Math.min(96, Math.floor(1 + 95 * (1 - (1 - t) ** 1.6))));
}
