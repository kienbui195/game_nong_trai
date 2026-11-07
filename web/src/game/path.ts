// Tìm đường A* trên lưới ô (4 hướng). Hàm thuần, test được.
export interface Pt {
  x: number;
  y: number;
}

export function findPath(blocked: boolean[][], from: Pt, to: Pt): Pt[] | null {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  const inside = (p: Pt) => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
  if (!inside(from) || !inside(to) || blocked[to.y][to.x]) return null;
  const key = (p: Pt) => p.y * cols + p.x;
  const h = (p: Pt) => Math.abs(p.x - to.x) + Math.abs(p.y - to.y);
  const g = new Map<number, number>([[key(from), 0]]);
  const came = new Map<number, number>();
  const open: { p: Pt; f: number }[] = [{ p: from, f: h(from) }];
  const closed = new Set<number>();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const { p } = open.shift()!;
    const k = key(p);
    if (closed.has(k)) continue;
    if (p.x === to.x && p.y === to.y) {
      const path: Pt[] = [p];
      let c = k;
      while (came.has(c)) {
        c = came.get(c)!;
        path.unshift({ x: c % cols, y: Math.floor(c / cols) });
      }
      return path;
    }
    closed.add(k);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (!inside(n) || blocked[n.y][n.x]) continue;
      const nk = key(n);
      const ng = g.get(k)! + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, k);
        open.push({ p: n, f: ng + h(n) });
      }
    }
  }
  return null;
}

/** Ô đứng được gần đích nhất (đích bị chặn thì tìm ô kề gần nhất đi tới được). */
export function nearestStand(blocked: boolean[][], from: Pt, target: Pt): Pt[] | null {
  const direct = findPath(blocked, from, target);
  if (direct) return direct;
  let best: Pt[] | null = null;
  for (let r = 1; r <= 3 && !best; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = findPath(blocked, from, { x: target.x + dx, y: target.y + dy });
        if (p && (!best || p.length < best.length)) best = p;
      }
  }
  return best;
}
