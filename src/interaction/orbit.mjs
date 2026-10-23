/** Two well-spaced moving lanes plus one accent rail (activates if > 24 tools). */
export const ORBIT_LANES = [
  { count: 8, rx: 0.26, ry: 0.245, speed: 0.095, phase: 0.2, tilt: -0.2 },
  { count: 11, rx: 0.455, ry: 0.44, speed: -0.045, phase: 0.7, tilt: 0.18 },
  { count: 0, rx: 0.395, ry: 0.225, speed: 0.067, phase: 0.35, tilt: -0.38 },
];

export function distributeLanes(total = 19) {
  const n = Math.max(0, Math.floor(total));
  if (n === 19) return [8, 11, 0];
  if (n === 0) return [0, 0, 0];
  if (n <= 8) return [n, 0, 0];
  if (n <= 24) {
    const inner = Math.max(4, Math.round((n * 8) / 19));
    return [inner, Math.max(0, n - inner), 0];
  }
  const inner = 9;
  const outer = 13;
  return [inner, outer, n - inner - outer];
}

export function orbitPoint(lane, angle) {
  const x = Math.cos(angle) * lane.rx;
  const y = Math.sin(angle) * lane.ry;
  const c = Math.cos(lane.tilt);
  const s = Math.sin(lane.tilt);
  return { x: 0.5 + x * c - y * s, y: 0.5 + x * s + y * c, z: Math.sin(angle + 0.5) };
}

export function orbitLayout(time = 0, rotation = 0, totalCount = 19) {
  const counts = distributeLanes(totalCount);
  const points = [];
  ORBIT_LANES.forEach((lane, ring) => {
    const count = counts[ring] || 0;
    for (let node = 0; node < count; node++) {
      const angle = (node / count) * Math.PI * 2 + lane.phase + time * lane.speed + rotation;
      points.push({ ...orbitPoint(lane, angle), ring, angle });
    }
  });
  return points;
}

export function orbitPath(lane) {
  return (
    Array.from({ length: 97 }, (_, i) => {
      const p = orbitPoint(lane, (i / 96) * Math.PI * 2);
      return `${i ? 'L' : 'M'}${(p.x * 1000).toFixed(2)},${(p.y * 1000).toFixed(2)}`;
    }).join(' ') + ' Z'
  );
}

export function advanceOrbit(state, delta) {
  const dt = Math.max(0, Math.min(0.08, delta));
  const decay = Math.exp(-5 * dt);
  return {
    time: state.time + dt,
    rotation: state.rotation + (state.momentum * (1 - decay)) / 5,
    momentum: state.momentum * decay,
  };
}

export function shouldAnimateOrbit({ visible, hidden, paused, reduced, selected, interacting, blocked }) {
  return visible && !hidden && !paused && !reduced && !selected && !interacting && !blocked;
}
