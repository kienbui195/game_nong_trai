import { describe, expect, test } from 'vitest';
import { blockedGrid } from '../src/game/layout';
import { findPath, nearestStand } from '../src/game/path';

describe('AC-02 tìm đường', () => {
  const g = blockedGrid();
  test('AC-02.1 đi từ cửa nhà tới ô đất xa nhất', () => {
    const p = findPath(g, { x: 2, y: 4 }, { x: 8, y: 10 });
    expect(p).not.toBeNull();
    expect(p![p!.length - 1]).toEqual({ x: 8, y: 10 });
    expect(p!.every((q) => !g[q.y][q.x])).toBe(true);
  });
  test('AC-02.2 chạm chỗ không đứng được (ao) thì đi tới ô kề gần nhất', () => {
    const p = nearestStand(g, { x: 2, y: 4 }, { x: 5, y: 13 });
    expect(p).not.toBeNull();
    const end = p![p!.length - 1];
    expect(g[end.y][end.x]).toBe(false);
    expect(Math.abs(end.x - 5) + Math.abs(end.y - 13)).toBeLessThanOrEqual(2);
  });
  test('AC-02.2 bị rào kín thì không có đường', () => {
    const closed = g.map((r) => r.slice());
    for (const [x, y] of [[0, 20], [1, 21], [1, 20]]) closed[y][x] = true;
    expect(findPath(closed, { x: 2, y: 4 }, { x: 0, y: 21 })).toBeNull();
  });
});
