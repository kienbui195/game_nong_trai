// Ô nào chặn đường, ô nào thuộc công trình nào: dựng từ bản đồ chung trong core.
import { BUILDING_SLOTS, HOUSE_RECT, MAP_COLS, MAP_ROWS, MARKET_RECT, PLOT_SLOTS, doorOf, type FarmView, type Rect } from '@core';

export type Target =
  | { kind: 'plot'; plotId: number }
  | { kind: 'lockedPlot' }
  | { kind: 'house' }
  | { kind: 'market' }
  | { kind: 'building'; buildingId: number }
  | { kind: 'emptyBuilding'; type: 'coop' | 'barn' | 'pond' };

export interface Zone {
  rect: Rect;
  stand: { x: number; y: number };
  target: Target;
}

export function zones(v: Pick<FarmView, 'plots' | 'buildings'>): Zone[] {
  const out: Zone[] = [
    { rect: HOUSE_RECT, stand: doorOf(HOUSE_RECT), target: { kind: 'house' } },
    { rect: MARKET_RECT, stand: doorOf(MARKET_RECT), target: { kind: 'market' } },
  ];
  PLOT_SLOTS.forEach((s, i) => {
    const owned = i < v.plots.length;
    out.push({ rect: { x: s.x, y: s.y, w: 1, h: 1 }, stand: s, target: owned ? { kind: 'plot', plotId: i } : { kind: 'lockedPlot' } });
  });
  for (const type of ['coop', 'barn', 'pond'] as const) {
    BUILDING_SLOTS[type].forEach((rect, slot) => {
      const b = v.buildings.find((x) => x.type === type && x.slot === slot);
      out.push({ rect, stand: doorOf(rect), target: b ? { kind: 'building', buildingId: b.id } : { kind: 'emptyBuilding', type } });
    });
  }
  return out;
}

/** Lưới chặn: nhà, chợ, chuồng, ao chặn; ô đất và cỏ đi được. */
export function blockedGrid(): boolean[][] {
  const g = Array.from({ length: MAP_ROWS }, () => Array.from({ length: MAP_COLS }, () => false));
  const block = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = true;
  };
  block(HOUSE_RECT);
  block(MARKET_RECT);
  for (const t of ['coop', 'barn', 'pond'] as const) BUILDING_SLOTS[t].forEach(block);
  return g;
}

export const zoneAt = (zs: Zone[], x: number, y: number) => zs.find((z) => x >= z.rect.x && x < z.rect.x + z.rect.w && y >= z.rect.y && y < z.rect.y + z.rect.h) ?? null;
