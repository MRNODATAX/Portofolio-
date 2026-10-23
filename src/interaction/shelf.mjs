/** Clamp each native snap point: the last mobile card cannot scroll beyond the shelf's end. */
export function shelfTargets(cards, viewportWidth, scrollWidth, centered) {
  const end = Math.max(0, scrollWidth - viewportWidth);
  return cards.map(card => Math.max(0, Math.min(end, card.left - (centered ? (viewportWidth - card.width) / 2 : 0))));
}

export function nearestShelfIndex(targets, scrollLeft) {
  let closest = 0, distance = Infinity;
  targets.forEach((target, index) => {
    const delta = Math.abs(target - scrollLeft);
    if (delta < distance) { closest = index; distance = delta; }
  });
  return closest;
}

export function shelfDragIntent(dx, dy) {
  return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15;
}
