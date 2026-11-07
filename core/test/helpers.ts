import { act, advance, catchUp, newFarm, view } from '../src/engine';
import type { ActCtx, Action, Farm, JobQuestion } from '../src/types';

export const T0 = Date.UTC(2026, 10, 1, 0, 0, 0);
export const MIN = 60_000;
export const H = 60 * MIN;
export const D = 24 * H;

export const fresh = (seed = 42) => newFarm(T0, seed);

/** Làm thao tác, bắt buộc thành công. */
/** Tắt sâu bệnh ngẫu nhiên trong test để kết quả không phụ thuộc may rủi (trừ test nói rõ). */
export const NP: ActCtx = { noPests: true };
export const cu = (f: Farm, t: number) => catchUp(f, t, NP);
export const vw = (f: Farm, t: number) => view(f, t, NP);

export function ok(f: Farm, a: Action, now: number, ctx: ActCtx = NP): Farm {
  const r = act(f, a, now, ctx);
  if (r.error) throw new Error(`${a.type} lỗi: ${r.error.code} ${r.error.message}`);
  return r.farm;
}

/** Phần người chơi thấy được của nông trại: dùng để kiểm "bị từ chối thì không đổi gì". */
const visible = (f: Farm) => ({ coins: f.coins, stamina: f.stamina, sleep: f.sleep, plots: f.plots, buildings: f.buildings, animals: f.animals, ponds: f.ponds, inventory: f.inventory, market: f.market, offers: f.job.offers, active: f.job.active, taken: f.job.taken, rerollCost: f.job.rerollCost });

/**
 * Làm thao tác, bắt buộc lỗi đúng mã, có thông báo cho người chơi,
 * và nông trại giữ nguyên như chỉ tính bù tới `now` (không làm nửa chừng).
 */
export function fail(f: Farm, a: Action, now: number, code: string, ctx: ActCtx = NP) {
  const r = act(f, a, now, ctx);
  if (!r.error) throw new Error(`${a.type} lẽ ra phải lỗi ${code}`);
  if (r.error.code !== code) throw new Error(`${a.type}: mong ${code}, nhận ${r.error.code}`);
  if (!r.error.message || r.error.message.length < 5) throw new Error(`${a.type}: lỗi ${code} thiếu thông báo`);
  const before = JSON.stringify(visible(advance(f, now, ctx)));
  const after = JSON.stringify(visible(r.farm));
  if (before !== after) throw new Error(`${a.type}: bị từ chối (${code}) nhưng nông trại đã đổi`);
  return r;
}

export const give = (f: Farm, item: string, n: number) => {
  f.inventory[item] = { n: (f.inventory[item]?.n ?? 0) + n, hq: f.inventory[item]?.hq ?? 0 };
  return f;
};

export const questions = (level: number, n = 10, start = 1): JobQuestion[] =>
  Array.from({ length: n }, (_, i) => ({ id: start + i, text: `Câu ${level}-${start + i}?`, options: ['A đúng', 'B', 'C', 'D'], correct: 0 }));

export const allLevels: ActCtx = { noPests: true, levelCounts: { 1: 50, 2: 50, 3: 50 } };
