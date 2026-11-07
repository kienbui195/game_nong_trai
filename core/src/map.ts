// Bản đồ nông trại màn dọc: 12 cột × 22 hàng ô. Dùng chung cho server (vị trí công trình) và giao diện (vẽ, tìm đường).
import { EXPANSION } from './config';

export const MAP_COLS = 12;
export const MAP_ROWS = 22;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const HOUSE_RECT: Rect = { x: 1, y: 1, w: 3, h: 3 };
export const MARKET_RECT: Rect = { x: 8, y: 1, w: 3, h: 3 };

/** 30 chỗ ô đất: khối 6 cột × 5 hàng, mở dần theo thứ tự. */
export const PLOT_SLOTS: { x: number; y: number }[] = Array.from({ length: EXPANSION.plotsMax }, (_, i) => ({ x: 3 + (i % 6), y: 6 + Math.floor(i / 6) }));

export const BUILDING_SLOTS: Record<'coop' | 'barn' | 'pond', Rect[]> = {
  coop: [
    { x: 0, y: 13, w: 3, h: 2 },
    { x: 0, y: 16, w: 3, h: 2 },
  ],
  barn: [
    { x: 9, y: 13, w: 3, h: 2 },
    { x: 9, y: 16, w: 3, h: 2 },
  ],
  pond: [
    { x: 4, y: 13, w: 4, h: 2 },
    { x: 4, y: 19, w: 4, h: 2 },
  ],
};

/** Ô cửa (đứng ở đây để vào nhà / chợ / công trình). */
export const doorOf = (r: Rect) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + r.h });
