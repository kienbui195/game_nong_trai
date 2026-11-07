// Lõi luật Nông Trại Xu: chỉ tính toán, không đọc ghi gì. Server dùng để làm trọng tài, giao diện dùng để hiện số.
import {
  ACTION_MEMORY_MS,
  ANIMAL_BY_ID,
  ANIMAL_HEALTH,
  CROP_BY_ID,
  CROP_HEALTH,
  CROPS,
  ANIMALS,
  DAY,
  EXPANSION,
  FERTILIZERS,
  FISH,
  FISH_BY_ID,
  HOUR,
  HQ_MULTIPLIER,
  JOB_REFRESH_MS,
  JOBS,
  MARKET,
  MARKET_PERIOD_MS,
  QUALITY_CAP,
  SEASON_DAYS,
  SEASON_LABEL,
  SLEEP_MS_PER_POINT,
  STAMINA_COST,
  STAMINA_MAX,
  START,
  STEP_MS,
  SUPPLIES,
  type BuildingType,
  type FertilizerId,
  type JobLevel,
  type Season,
  table,
} from './config';
import { dayInSeason, dayNo, seasonAt, seasonEndsAt, seasonNo, yearNo } from './calendar';
import { rand, randInt } from './rng';
import { SCHEMA_VERSION, type ActCtx, type Action, type Animal, type CropState, type Farm, type GameError, type JobOffer, type PondState } from './types';

// ---------------------------------------------------------------- lỗi

class GameFail extends Error {
  constructor(public ge: GameError) {
    super(ge.message);
  }
}
const fail = (code: string, message: string, data?: Record<string, unknown>): never => {
  throw new GameFail({ code, message, ...(data ? { data } : {}) });
};

const clone = <T>(x: T): T => structuredClone(x);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const STEP_H = STEP_MS / HOUR;

// ---------------------------------------------------------------- tên đồ

export function itemName(id: string): string {
  const [kind, key] = id.split(':');
  if (kind === 'seed') {
    const c = CROP_BY_ID[key];
    return c ? (c.kind === 'tree' ? `Cây ${c.name.toLowerCase()} con` : `Hạt ${c.name.toLowerCase()}`) : id;
  }
  if (kind === 'crop') return CROP_BY_ID[key]?.name ?? id;
  if (kind === 'prod') return ANIMALS.find((a) => a.product === key)?.productName ?? id;
  if (kind === 'fish') return FISH_BY_ID[key]?.name ?? id;
  return SUPPLIES[id]?.name ?? id;
}

export function itemEmoji(id: string): string {
  const [kind, key] = id.split(':');
  if (kind === 'seed' || kind === 'crop') return CROP_BY_ID[key]?.emoji ?? '❔';
  if (kind === 'prod') return ANIMALS.find((a) => a.product === key)?.productEmoji ?? '❔';
  if (kind === 'fish') return FISH_BY_ID[key]?.emoji ?? '🐟';
  return SUPPLIES[id]?.emoji ?? '📦';
}

/** Giá mua cố định ở cửa hàng; null = không bán ở cửa hàng. */
export function shopPrice(id: string): number | null {
  const [kind, key] = id.split(':');
  if (kind === 'seed') return CROP_BY_ID[key]?.seedPrice ?? null;
  return SUPPLIES[id]?.price ?? null;
}

// ---------------------------------------------------------------- tạo nông trại

export function newFarm(now: number, seed: number, ctx: ActCtx = {}): Farm {
  const createdAt = Math.floor(now / STEP_MS) * STEP_MS; // mốc tròn 10 phút để bước mô phỏng thẳng hàng
  const f: Farm = {
    schemaVersion: SCHEMA_VERSION,
    seed: seed >>> 0,
    createdAt,
    simAt: createdAt,
    coins: START.coins,
    stamina: START.stamina,
    sleep: null,
    plots: Array.from({ length: START.plots }, (_, i) => ({ id: i, crop: null })),
    plotBuys: 0,
    buildings: [],
    animals: [],
    ponds: [],
    inventory: {},
    market: {},
    job: { offers: [], nextFreeAt: createdAt + JOB_REFRESH_MS, rerollCost: JOBS.rerollFirst, day: 0, taken: 0, active: null, last: null, seen: [], emptyBank: true },
    recent: [],
    nextId: 1,
    actCounter: 0,
  };
  if (ctx.levelCounts) {
    f.job.offers = genOffers(f, ctx);
    f.job.emptyBank = f.job.offers.length === 0;
  }
  return f;
}

// ---------------------------------------------------------------- thể lực

export function staminaAt(f: Farm, now: number): number {
  if (!f.sleep) return f.stamina;
  return Math.min(STAMINA_MAX, f.sleep.base + Math.floor(Math.max(0, now - f.sleep.since) / SLEEP_MS_PER_POINT));
}

function wake(f: Farm, now: number) {
  if (!f.sleep) return;
  f.stamina = staminaAt(f, now);
  f.sleep = null;
}

function spend(f: Farm, n: number, now: number) {
  wake(f, now); // việc lao động khi đang ngủ: tự dậy trước (US-03)
  if (f.stamina < n) fail('no_stamina', `Thiếu ${n - f.stamina} thể lực. Về nhà ngủ để hồi sức nhé.`, { need: n, have: f.stamina });
  f.stamina -= n;
}

// ---------------------------------------------------------------- kho

function take(f: Farm, id: string, n = 1) {
  const s = f.inventory[id];
  if (!s || s.n < n) fail('no_item', `Không có đủ ${itemName(id).toLowerCase()} trong kho.`, { itemId: id });
  s!.n -= n;
}
function add(f: Farm, id: string, n: number, hq = 0) {
  const s = (f.inventory[id] ??= { n: 0, hq: 0 });
  s.n += n;
  s.hq += hq;
}
function pay(f: Farm, price: number) {
  if (f.coins < price) fail('no_coins', `Thiếu ${price - f.coins} xu.`, { need: price, have: f.coins });
  f.coins -= price;
}
const nextRand = (f: Farm, ...keys: (string | number)[]) => rand(f.seed, 'act', f.actCounter++, ...keys);

// ---------------------------------------------------------------- chất lượng

export function harvestQualityChance(health: number, fert: FertilizerId | null): number {
  return Math.min(QUALITY_CAP, CROP_HEALTH.qualityMax * (clamp(health) / 100) + (fert ? FERTILIZERS[fert].quality : 0));
}
export function animalQualityChance(health: number, affection: number): number {
  return Math.min(QUALITY_CAP, QUALITY_CAP * (clamp(health) / 100) * (0.5 + clamp(affection) / 200));
}

/** phân bón còn tác dụng không (cây ăn quả: chỉ trong mùa đã bón) */
function fertActive(f: Farm, c: CropState, t: number): FertilizerId | null {
  if (!c.fertilizer) return null;
  const def = CROP_BY_ID[c.cropId];
  if (def.kind === 'tree' && c.fertilizedSeasonNo !== seasonNo(f, t)) return null;
  return c.fertilizer;
}

// ---------------------------------------------------------------- tính bù

/** Trả bản sao nông trại đã tính bù tới `now` (bước 10 phút, thẳng hàng với lúc tạo nông trại). */
export function catchUp(f: Farm, now: number, ctx: ActCtx = {}): Farm {
  const g = clone(f);
  simulate(g, now, ctx);
  return g;
}

function simulate(f: Farm, now: number, ctx: ActCtx) {
  while (f.simAt + STEP_MS <= now) {
    const t0 = f.simAt;
    const t1 = t0 + STEP_MS;
    const k = (t0 - f.createdAt) / STEP_MS;
    for (const p of f.plots) if (p.crop) stepCrop(f, p.id, p.crop, t0, t1, k, ctx);
    for (const a of f.animals) stepAnimal(f, a, t1, k);
    for (const p of f.ponds) stepPond(p, t1);
    f.simAt = t1;
    if ((t1 - f.createdAt) % DAY === 0) dayBoundary(f, t1); // qua mốc ngày (và mốc mùa) đúng lúc
  }
}

function dayBoundary(f: Farm, t0: number) {
  const d = dayNo(f, t0);
  // sang mùa mới: cây ngắn/dài ngày của mùa cũ héo (BR8)
  if (d % SEASON_DAYS === 0) {
    for (const p of f.plots) {
      const c = p.crop;
      if (c && !c.withered && CROP_BY_ID[c.cropId].kind !== 'tree') c.withered = true;
    }
  }
  // một ngày không ai vuốt ve / trò chuyện / dắt dạo: tình cảm −5
  const prev = d - 1;
  for (const a of f.animals) if (a.boughtAt < t0 && a.lastInteractDay !== prev) a.affection = clamp(a.affection - ANIMAL_HEALTH.idleDayPenalty);
  for (const p of f.ponds) if (p.fish.length && p.lastInteractDay !== prev) p.affection = clamp(p.affection - ANIMAL_HEALTH.idleDayPenalty);
}

function stepCrop(f: Farm, plotId: number, c: CropState, t0: number, t1: number, k: number, ctx: ActCtx) {
  const def = CROP_BY_ID[c.cropId];
  if (c.withered || c.ripe) return;
  if (def.kind === 'tree' && seasonAt(f, t0) !== def.season) return; // cây ăn quả ngoài mùa: ngủ
  const dry = c.lastWateredAt === null || t1 - c.lastWateredAt > CROP_HEALTH.waterValidMs;
  const pest = c.pestSince !== null;
  let grow = true;
  let dh = 0;
  if (dry) {
    grow = false;
    dh += CROP_HEALTH.dryPerHour * STEP_H;
  }
  if (pest) {
    grow = false;
    dh += CROP_HEALTH.pestPerHour * STEP_H;
  }
  if (!dry && !pest) {
    if (c.recoverMs > 0) {
      grow = false;
      dh += CROP_HEALTH.recoverPerHour * STEP_H;
      c.recoverMs = Math.max(0, c.recoverMs - STEP_MS);
    } else {
      if (c.health <= 0) grow = false; // kiệt sức: hồi lên rồi mới lớn
      dh += CROP_HEALTH.wateredPerHour * STEP_H;
    }
  }
  c.health = clamp(c.health + dh);
  if (grow) {
    const fert = fertActive(f, c, t0);
    const inc = Math.round(STEP_MS * (1 + (fert ? FERTILIZERS[fert].speed : 0)));
    if (def.kind === 'tree' && c.mature) {
      if (!c.fruitReady) {
        c.cycleMs += inc;
        if (c.cycleMs >= def.cycleMs!) {
          c.fruitReady = true;
          c.cycleMs = 0;
        }
      }
    } else {
      c.growMs += inc;
      if (c.growMs >= def.growMs) {
        c.growMs = def.growMs;
        if (def.kind === 'tree') c.mature = true;
        else c.ripe = true;
      }
    }
  }
  if (!pest && !c.ripe && !ctx.noPests) {
    const perHour = dry || c.health < CROP_HEALTH.stressedBelow ? CROP_HEALTH.pestChanceStressedPerHour : CROP_HEALTH.pestChancePerHour;
    if (rand(f.seed, 'pest', plotId, k) < perHour * STEP_H) c.pestSince = t1;
  }
}

function stepAnimal(f: Farm, a: Animal, t1: number, k: number) {
  const def = ANIMAL_BY_ID[a.species];
  const hungry = a.lastFedAt === null || t1 - a.lastFedAt > ANIMAL_HEALTH.feedValidMs;
  if (hungry) a.health = clamp(a.health + ANIMAL_HEALTH.hungryPerHour * STEP_H);
  else if (!a.sick) {
    a.health = clamp(a.health + ANIMAL_HEALTH.fedPerHour * STEP_H);
    if (!a.mature) {
      a.ageMs += STEP_MS;
      if (a.ageMs >= def.matureMs) {
        a.ageMs = def.matureMs;
        a.mature = true;
      }
    } else if (!a.product) {
      a.cycleMs += STEP_MS;
      if (a.cycleMs >= def.cycleMs) {
        a.cycleMs = 0;
        a.product = { qty: def.productQty, hq: rand(f.seed, 'prod', a.id, k) < animalQualityChance(a.health, a.affection) };
      }
    }
  }
  if (!a.sick && a.health < ANIMAL_HEALTH.sickBelow) a.sick = true;
}

function stepPond(p: PondState, t1: number) {
  if (!p.fish.length) return;
  const hungry = p.lastFedAt === null || t1 - p.lastFedAt > ANIMAL_HEALTH.feedValidMs;
  if (hungry) p.health = clamp(p.health + ANIMAL_HEALTH.hungryPerHour * STEP_H);
  else if (!p.sick) {
    p.health = clamp(p.health + ANIMAL_HEALTH.fedPerHour * STEP_H);
    for (const fish of p.fish) fish.ageMs = Math.min(FISH_BY_ID[fish.species].matureMs, fish.ageMs + STEP_MS);
  }
  if (!p.sick && p.health < ANIMAL_HEALTH.sickBelow) p.sick = true;
}

/** Tính bù + chốt các việc theo giờ (hết giờ câu hỏi, làm mới việc, qua ngày). Server gọi trước khi lưu khi chỉ mở game. */
export function advance(f: Farm, now: number, ctx: ActCtx = {}): Farm {
  const g = clone(f);
  simulate(g, now, ctx);
  settle(g, now, ctx);
  return g;
}

// ---------------------------------------------------------------- việc làm thêm

function genOffers(f: Farm, ctx: ActCtx): JobOffer[] {
  const levels = ([1, 2, 3] as JobLevel[]).filter((l) => (ctx.levelCounts?.[l] ?? 0) >= JOBS.questionsPerJob);
  if (!levels.length) return [];
  return Array.from({ length: JOBS.offers }, () => {
    const key = f.actCounter++;
    const level = levels[randInt(f.seed, 0, levels.length - 1, 'job', key, 'lv')];
    const L = JOBS.levels[level];
    return { id: f.nextId++, level, fee: randInt(f.seed, L.fee[0], L.fee[1], 'job', key, 'fee'), reward: randInt(f.seed, L.reward[0], L.reward[1], 'job', key, 'rw') };
  });
}

function jobFail(f: Farm, now: number, reason: 'wrong' | 'timeout') {
  const j = f.job.active!;
  const q = j.questions[j.idx];
  f.job.last = { ok: false, level: j.level, fee: j.fee, reward: j.reward, answered: j.idx, reason, missed: { text: q.text, answer: q.options[q.correct] }, at: now };
  f.job.active = null;
}

function settle(f: Farm, now: number, ctx: ActCtx, skipJobTimeout = false) {
  const j = f.job;
  if (!skipJobTimeout && j.active && now > j.active.deadline) jobFail(f, now, 'timeout');
  if (now >= j.nextFreeAt && ctx.levelCounts) {
    j.offers = genOffers(f, ctx);
    j.emptyBank = j.offers.length === 0;
    j.rerollCost = JOBS.rerollFirst;
    j.nextFreeAt = f.createdAt + (Math.floor((now - f.createdAt) / JOB_REFRESH_MS) + 1) * JOB_REFRESH_MS;
  } else if (j.emptyBank && ctx.levelCounts) {
    j.offers = genOffers(f, ctx);
    j.emptyBank = j.offers.length === 0;
  }
  const today = dayNo(f, now);
  if (j.day !== today) {
    j.day = today;
    j.taken = 0;
  }
  f.recent = f.recent.filter((r) => now - r.at < ACTION_MEMORY_MS);
}

// ---------------------------------------------------------------- chợ

export interface MarketRow {
  itemId: string;
  base: number;
  factor: number;
  seasonFactor: number;
  drop: number;
  price: number;
  hqPrice: number;
  prevPrice: number;
  trend: 'up' | 'down' | 'flat';
}

export const SELLABLES: { id: string; base: number; season: Season | null }[] = [
  ...CROPS.map((c) => ({ id: `crop:${c.id}`, base: c.sellPrice, season: c.season as Season | null })),
  ...ANIMALS.map((a) => ({ id: `prod:${a.product}`, base: a.productPrice, season: null })),
  ...FISH.map((x) => ({ id: `fish:${x.id}`, base: x.sellPrice, season: null })),
];
const SELLABLE_BY_ID = table(SELLABLES.map((s) => [s.id, s] as const));

const periodNo = (f: Farm, t: number) => Math.floor((t - f.createdAt) / MARKET_PERIOD_MS);
const periodFactor = (f: Farm, item: string, p: number) => MARKET.minFactor + (MARKET.maxFactor - MARKET.minFactor) * rand(f.seed, 'mkt', item, p);
const seasonFactor = (f: Farm, item: string, t: number) => {
  const s = SELLABLE_BY_ID[item]?.season;
  if (!s) return 1;
  return seasonAt(f, Math.max(t, f.createdAt)) === s ? MARKET.inSeason : MARKET.offSeason;
};
const effDrop = (f: Farm, item: string, t: number) => {
  const m = f.market[item];
  if (!m) return 0;
  return Math.max(0, m.drop - (MARKET.recoverPerHour * Math.max(0, t - m.at)) / HOUR);
};
const unitPrice = (f: Farm, item: string, t: number, drop: number, hq: boolean) => {
  const s = SELLABLE_BY_ID[item];
  const p = Math.max(1, Math.round(s.base * periodFactor(f, item, periodNo(f, t)) * seasonFactor(f, item, t) * (1 - drop)));
  return hq ? Math.round(p * HQ_MULTIPLIER) : p;
};

/** Giá bán một cái ngay bây giờ. */
export function marketPrice(f: Farm, item: string, t: number, hq: boolean): number {
  if (!SELLABLE_BY_ID[item]) return 0;
  return unitPrice(f, item, t, effDrop(f, item, t), hq);
}

function marketRow(f: Farm, item: string, t: number): MarketRow {
  const s = SELLABLE_BY_ID[item];
  const p = periodNo(f, t);
  const factor = periodFactor(f, item, p);
  const sf = seasonFactor(f, item, t);
  const drop = effDrop(f, item, t);
  const price = unitPrice(f, item, t, drop, false);
  const prevPrice = p === 0 ? price : unitPrice(f, item, Math.max(f.createdAt, t - MARKET_PERIOD_MS), 0, false);
  const diff = (price - prevPrice) / prevPrice;
  return { itemId: item, base: s.base, factor, seasonFactor: sf, drop, price, hqPrice: Math.round(price * HQ_MULTIPLIER), prevPrice, trend: Math.abs(diff) < MARKET.flatBelow ? 'flat' : diff > 0 ? 'up' : 'down' };
}

function sellUnits(f: Farm, item: string, n: number, hq: boolean, now: number): number {
  const d0 = effDrop(f, item, now);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += unitPrice(f, item, now, Math.min(MARKET.maxDrop, d0 + i * MARKET.dropPerUnit), hq);
  f.market[item] = { drop: Math.min(MARKET.maxDrop, d0 + n * MARKET.dropPerUnit), at: now };
  return sum;
}

// ---------------------------------------------------------------- mở rộng

export const plotPrice = (f: Farm) => (f.plots.length >= EXPANSION.plotsMax ? null : EXPANSION.plotFirstPrice * 2 ** f.plotBuys);
export const buildPrice = (f: Farm, type: BuildingType) => {
  const n = f.buildings.filter((b) => b.type === type).length;
  return EXPANSION.build[type].prices[n] ?? null;
};

// ---------------------------------------------------------------- thao tác

export interface ActResult {
  farm: Farm;
  error?: GameError;
  /** mã thao tác đã làm rồi: trả kết quả cũ, không làm lại */
  replay?: boolean;
}

/**
 * Làm một thao tác lúc `now` (giờ server). Tính bù trước, kiểm hợp lệ, rồi làm.
 * Lỗi thì trả nông trại đã tính bù nhưng chưa làm gì (không ghi nửa chừng).
 */
export function act(farm: Farm, a: Action, now: number, ctx: ActCtx = {}, actionId?: string): ActResult {
  const base = clone(farm);
  simulate(base, now, ctx);
  settle(base, now, ctx, a.type === 'answer');
  if (actionId) {
    const seen = base.recent.find((r) => r.id === actionId);
    if (seen) return { farm: base, replay: true, ...(seen.error ? { error: seen.error } : {}) };
  }
  const work = clone(base);
  try {
    apply(work, a, now, ctx);
    if (actionId) work.recent.push({ id: actionId, at: now, error: null });
    return { farm: work };
  } catch (e) {
    if (!(e instanceof GameFail)) throw e;
    if (actionId) base.recent.push({ id: actionId, at: now, error: e.ge });
    return { farm: base, error: e.ge };
  }
}

const plotOf = (f: Farm, id: number) => f.plots.find((p) => p.id === id) ?? fail('no_plot', 'Không có ô đất này.');
const cropOf = (f: Farm, id: number) => plotOf(f, id).crop ?? fail('empty', 'Ô này đang trống.');
const animalOf = (f: Farm, id: number) => f.animals.find((x) => x.id === id) ?? fail('no_animal', 'Không có con này.');
const pondOf = (f: Farm, id: number) => f.ponds.find((x) => x.buildingId === id) ?? fail('no_pond', 'Không có ao này.');
const buildingOf = (f: Farm, id: number) => f.buildings.find((x) => x.id === id) ?? fail('no_building', 'Không có công trình này.');
export const feedFor = (sp: string) => (ANIMAL_BY_ID[sp].building === 'coop' ? 'feed:poultry' : 'feed:livestock');
export const medFor = (sp: string) => (ANIMAL_BY_ID[sp].building === 'coop' ? 'med:poultry' : 'med:livestock');
/** BR13: chưa trưởng thành 1/2 giá mua, trưởng thành giá mua + 10%. */
export const animalSellPrice = (a: Pick<Animal, 'species' | 'mature'>) => {
  const p = ANIMAL_BY_ID[a.species].price;
  return a.mature ? Math.round(p * 1.1) : Math.round(p / 2);
};
const intN = (n: unknown, lo: number, hi: number) => {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < lo || n > hi) fail('bad_input', `Số lượng phải từ ${lo} đến ${hi}.`);
  return n as number;
};

/** Trường mã trong thao tác phải là chuỗi (thao tác đến thẳng từ máy người chơi). */
const ID_FIELDS = ['itemId', 'species', 'cropId', 'fertilizer', 'what'] as const;

function apply(f: Farm, a: Action, now: number, ctx: ActCtx) {
  for (const k of ID_FIELDS) if (k in a && typeof (a as Record<string, unknown>)[k] !== 'string') fail('bad_input', 'Thao tác không hợp lệ.');
  const today = dayNo(f, now);
  switch (a.type) {
    case 'sleep':
      if (f.sleep) fail('already', 'Đang ngủ rồi.');
      f.sleep = { since: now, base: f.stamina };
      return;
    case 'wake':
      if (!f.sleep) fail('already', 'Đang thức rồi.');
      wake(f, now);
      return;

    case 'plant': {
      const p = plotOf(f, a.plotId);
      if (p.crop) fail('occupied', 'Ô này đã có cây.');
      const def = CROP_BY_ID[a.cropId] ?? fail('bad_input', 'Không có loại cây này.');
      if (def.season !== seasonAt(f, now)) fail('wrong_season', `${def.name} chỉ trồng được vào mùa ${SEASON_LABEL[def.season]}.`);
      take(f, `seed:${def.id}`);
      if (def.kind !== 'tree' && !a.confirmLate && now + def.growMs > seasonEndsAt(f, now))
        fail('late', `${def.name} không kịp chín trước khi hết mùa, sẽ bị héo. Vẫn gieo?`, { endsAt: seasonEndsAt(f, now) });
      spend(f, STAMINA_COST.plant, now);
      p.crop = {
        cropId: def.id,
        plantedAt: now,
        growMs: 0,
        health: CROP_HEALTH.start,
        lastWateredAt: null,
        fertilizer: null,
        fertilizedSeasonNo: null,
        pestSince: null,
        recoverMs: 0,
        ripe: false,
        mature: false,
        cycleMs: 0,
        fruitReady: false,
        withered: false,
      };
      return;
    }
    case 'water': {
      const c = cropOf(f, a.plotId);
      if (c.withered) fail('withered', 'Cây đã héo, chỉ dọn được thôi.');
      if (c.ripe) fail('ripe', 'Cây đã chín, thu hoạch thôi.');
      spend(f, STAMINA_COST.water, now);
      c.lastWateredAt = now;
      return;
    }
    case 'fertilize': {
      const c = cropOf(f, a.plotId);
      if (c.withered || c.ripe) fail('bad_state', 'Không bón được lúc này.');
      if (!FERTILIZERS[a.fertilizer]) fail('bad_input', 'Không có loại phân này.');
      const tree = CROP_BY_ID[c.cropId].kind === 'tree';
      if (c.fertilizer && (!tree || c.fertilizedSeasonNo === seasonNo(f, now))) fail('already_fertilized', 'Vụ này đã bón phân rồi.');
      take(f, `fert:${a.fertilizer}`);
      spend(f, STAMINA_COST.fertilize, now);
      c.fertilizer = a.fertilizer;
      c.fertilizedSeasonNo = seasonNo(f, now);
      return;
    }
    case 'spray': {
      const c = cropOf(f, a.plotId);
      if (c.pestSince === null) fail('no_pest', 'Cây không bị sâu.');
      take(f, 'med:pest');
      spend(f, STAMINA_COST.spray, now);
      const dur = Math.max(0, now - c.pestSince!);
      c.pestSince = null;
      c.recoverMs = dur >= CROP_HEALTH.earlySprayMs ? Math.min(dur, CROP_HEALTH.maxRecoverMs) : 0;
      return;
    }
    case 'harvest': {
      const p = plotOf(f, a.plotId);
      const c = p.crop ?? fail('empty', 'Ô đã trống.');
      const def = CROP_BY_ID[c.cropId];
      if (c.withered) fail('withered', 'Cây đã héo, chỉ dọn được thôi.');
      const ready = def.kind === 'tree' ? c.fruitReady : c.ripe;
      if (!ready) fail('not_ripe', def.kind === 'tree' ? 'Cây chưa có quả.' : 'Cây chưa chín.');
      spend(f, STAMINA_COST.harvest, now);
      const chance = harvestQualityChance(c.health, fertActive(f, c, now));
      let hq = 0;
      for (let i = 0; i < def.yield; i++) if (nextRand(f, 'hq', i) < chance) hq++;
      add(f, `crop:${def.id}`, def.yield - hq, hq);
      if (def.kind === 'tree') c.fruitReady = false;
      else p.crop = null;
      return;
    }
    case 'clear': {
      const p = plotOf(f, a.plotId);
      const c = p.crop ?? fail('empty', 'Ô đã trống.');
      if (!c.withered && CROP_BY_ID[c.cropId].kind !== 'tree') fail('bad_state', 'Chỉ dọn cây héo hoặc chặt cây ăn quả.');
      spend(f, STAMINA_COST.clear, now);
      p.crop = null;
      return;
    }

    case 'buyAnimal': {
      const def = ANIMAL_BY_ID[a.species] ?? fail('bad_input', 'Không có loài này.');
      const b = buildingOf(f, a.buildingId);
      if (b.type !== def.building) fail('wrong_building', def.building === 'coop' ? 'Cần chuồng gia cầm.' : 'Chưa có chuồng gia súc cho con này.');
      if (f.animals.filter((x) => x.buildingId === b.id).length >= b.capacity) fail('full', 'Chuồng đầy rồi.');
      pay(f, def.price);
      f.animals.push({
        id: f.nextId++,
        species: def.id,
        buildingId: b.id,
        boughtAt: now,
        ageMs: 0,
        mature: false,
        health: ANIMAL_HEALTH.start,
        affection: ANIMAL_HEALTH.affectionStart,
        lastFedAt: null,
        sick: false,
        cycleMs: 0,
        product: null,
        petDay: -1,
        walkDay: -1,
        lastInteractDay: -1,
      });
      return;
    }
    case 'feed': {
      const x = animalOf(f, a.animalId);
      take(f, feedFor(x.species));
      spend(f, STAMINA_COST.feed, now);
      x.lastFedAt = now;
      return;
    }
    case 'pet':
    case 'walk': {
      const x = animalOf(f, a.animalId);
      const key = a.type === 'pet' ? 'petDay' : 'walkDay';
      if (x[key] === today) fail('already_today', a.type === 'pet' ? 'Hôm nay đã vuốt ve con này rồi.' : 'Hôm nay đã dắt con này đi dạo rồi.');
      spend(f, STAMINA_COST[a.type], now);
      x[key] = today;
      x.lastInteractDay = today;
      x.affection = clamp(x.affection + (a.type === 'pet' ? ANIMAL_HEALTH.pet : ANIMAL_HEALTH.walk));
      return;
    }
    case 'collect': {
      const x = animalOf(f, a.animalId);
      if (!x.product) fail('no_product', 'Chưa có sản phẩm để thu.');
      spend(f, STAMINA_COST.collect, now);
      const def = ANIMAL_BY_ID[x.species];
      add(f, `prod:${def.product}`, x.product!.hq ? 0 : x.product!.qty, x.product!.hq ? x.product!.qty : 0);
      x.product = null;
      return;
    }
    case 'medicate': {
      const x = animalOf(f, a.animalId);
      if (!x.sick) fail('not_sick', 'Con này không ốm.');
      take(f, medFor(x.species));
      spend(f, STAMINA_COST.medicate, now);
      x.sick = false;
      x.health = Math.max(x.health, ANIMAL_HEALTH.afterMedicine);
      return;
    }
    case 'sellAnimal': {
      const x = animalOf(f, a.animalId);
      f.coins += animalSellPrice(x);
      f.animals = f.animals.filter((y) => y.id !== x.id);
      return;
    }

    case 'buyFish': {
      const def = FISH_BY_ID[a.species] ?? fail('bad_input', 'Không có loài cá này.');
      const n = intN(a.n, 1, 20);
      const b = buildingOf(f, a.buildingId);
      const p = pondOf(f, b.id);
      if (p.fish.length + n > b.capacity) fail('full', `Ao chỉ còn ${b.capacity - p.fish.length} chỗ.`);
      pay(f, def.price * n);
      for (let i = 0; i < n; i++) p.fish.push({ id: f.nextId++, species: def.id, ageMs: 0 });
      return;
    }
    case 'feedPond': {
      const p = pondOf(f, a.buildingId);
      if (!p.fish.length) fail('empty', 'Ao chưa có cá.');
      take(f, 'feed:fish');
      spend(f, STAMINA_COST.feedPond, now);
      p.lastFedAt = now;
      return;
    }
    case 'talkPond': {
      const p = pondOf(f, a.buildingId);
      if (!p.fish.length) fail('empty', 'Ao chưa có cá.');
      if (p.talkDay === today) fail('already_today', 'Hôm nay đã trò chuyện với ao này rồi.');
      spend(f, STAMINA_COST.talkPond, now);
      p.talkDay = today;
      p.lastInteractDay = today;
      p.affection = clamp(p.affection + ANIMAL_HEALTH.pet);
      return;
    }
    case 'medicatePond': {
      const p = pondOf(f, a.buildingId);
      if (!p.sick) fail('not_sick', 'Ao không có cá ốm.');
      take(f, 'med:fish');
      spend(f, STAMINA_COST.medicatePond, now);
      p.sick = false;
      p.health = Math.max(p.health, ANIMAL_HEALTH.afterMedicine);
      return;
    }
    case 'sellFish': {
      const p = pondOf(f, a.buildingId);
      const fish = p.fish.find((x) => x.id === a.fishId) ?? fail('no_fish', 'Không có con cá này.');
      const def = FISH_BY_ID[fish.species];
      if (fish.ageMs < def.matureMs) fail('not_mature', 'Cá chưa lớn, chưa bán được.');
      const item = `fish:${def.id}`;
      const price = marketPrice(f, item, now, false);
      if (a.expected !== undefined && a.expected !== price) fail('price_changed', `Giá đã đổi thành ${price} xu.`, { price });
      const hq = nextRand(f, 'fishq') < animalQualityChance(p.health, p.affection);
      f.coins += sellUnits(f, item, 1, hq, now);
      p.fish = p.fish.filter((x) => x.id !== fish.id);
      return;
    }

    case 'buy': {
      const price = shopPrice(a.itemId) ?? fail('bad_input', 'Cửa hàng không bán món này.');
      const n = intN(a.n, 1, 99);
      const def = a.itemId.startsWith('seed:') ? CROP_BY_ID[a.itemId.slice(5)] : null;
      if (def && def.season !== seasonAt(f, now)) fail('wrong_season', `Mùa này không bán ${itemName(a.itemId).toLowerCase()}.`);
      pay(f, price * n);
      add(f, a.itemId, n);
      return;
    }
    case 'sell': {
      if (!SELLABLE_BY_ID[a.itemId]) fail('bad_input', 'Chợ không mua món này.');
      const n = intN(a.n, 1, 999);
      const s = f.inventory[a.itemId];
      const have = s ? (a.hq ? s.hq : s.n) : 0;
      if (have < n) fail('not_enough', `Chỉ có ${have} ${itemName(a.itemId).toLowerCase()}.`);
      const price = marketPrice(f, a.itemId, now, a.hq);
      if (a.expected !== price) fail('price_changed', `Giá đã đổi thành ${price} xu.`, { price });
      f.coins += sellUnits(f, a.itemId, n, a.hq, now);
      if (a.hq) s!.hq -= n;
      else s!.n -= n;
      return;
    }

    case 'expand': {
      if (a.what === 'plots') {
        const price = plotPrice(f) ?? fail('max', 'Đất đã tối đa.');
        pay(f, price);
        const start = f.plots.length;
        for (let i = 0; i < EXPANSION.plotsPerBuy && f.plots.length < EXPANSION.plotsMax; i++) f.plots.push({ id: start + i, crop: null });
        f.plotBuys++;
        return;
      }
      const cfg = EXPANSION.build[a.what] ?? fail('bad_input', 'Không có công trình này.');
      const price = buildPrice(f, a.what) ?? fail('max', `${cfg.label} đã tối đa.`);
      pay(f, price);
      const slot = f.buildings.filter((b) => b.type === a.what).length;
      const b = { id: f.nextId++, type: a.what, slot, capacity: cfg.capacity, upgraded: false };
      f.buildings.push(b);
      if (a.what === 'pond') f.ponds.push({ buildingId: b.id, fish: [], health: ANIMAL_HEALTH.start, affection: ANIMAL_HEALTH.affectionStart, lastFedAt: null, sick: false, talkDay: -1, lastInteractDay: -1 });
      return;
    }
    case 'upgrade': {
      const b = buildingOf(f, a.buildingId);
      if (b.upgraded) fail('max', 'Công trình này đã nâng rồi.');
      const cfg = EXPANSION.build[b.type];
      pay(f, cfg.upgradePrice);
      b.capacity += cfg.upgradeAdd;
      b.upgraded = true;
      return;
    }

    case 'rerollJobs': {
      if (f.job.active) fail('busy', 'Đang làm dở một việc.');
      pay(f, f.job.rerollCost);
      f.job.offers = genOffers(f, ctx);
      f.job.emptyBank = f.job.offers.length === 0;
      f.job.rerollCost *= 2;
      return;
    }
    case 'acceptJob': {
      const j = f.job;
      if (j.active) fail('busy', 'Đang làm dở một việc.');
      if (j.taken >= JOBS.perDay) fail('job_limit', `Hôm nay đã nhận đủ ${JOBS.perDay} việc. Ngày mới quay lại nhé.`, { resetAt: f.createdAt + (today + 1) * DAY });
      const offer = j.offers.find((o) => o.id === a.offerId) ?? fail('no_offer', 'Việc này không còn.');
      if (f.coins < offer.fee) fail('no_coins', `Thiếu ${offer.fee - f.coins} xu để nhận việc.`, { need: offer.fee, have: f.coins });
      const qs = ctx.questions ?? [];
      if (qs.length < JOBS.questionsPerJob) fail('no_questions', 'Chưa đủ câu hỏi cho việc này.');
      f.coins -= offer.fee;
      j.taken++;
      j.offers = j.offers.filter((o) => o.id !== offer.id);
      j.active = { ...offer, questions: clone(qs.slice(0, JOBS.questionsPerJob)), idx: 0, deadline: now + JOBS.answerMs };
      j.seen = [...j.seen, ...j.active.questions.map((q) => q.id)].slice(-JOBS.seenMemory);
      return;
    }
    case 'answer': {
      const j = f.job.active ?? fail('no_job', 'Không có việc nào đang làm.');
      if (a.idx !== j.idx) fail('stale', 'Câu này đã trả lời rồi.');
      if (now > j.deadline) return jobFail(f, now, 'timeout');
      if (a.choice !== j.questions[j.idx].correct) return jobFail(f, now, 'wrong');
      j.idx++;
      if (j.idx >= j.questions.length) {
        f.coins += j.reward;
        f.job.last = { ok: true, level: j.level, fee: j.fee, reward: j.reward, answered: j.idx, at: now };
        f.job.active = null;
      } else j.deadline = now + JOBS.answerMs;
      return;
    }
  }
  fail('bad_input', 'Thao tác không hợp lệ.');
}

// ---------------------------------------------------------------- dữ liệu cho giao diện

export interface CropView extends CropState {
  name: string;
  emoji: string;
  kind: 'short' | 'long' | 'tree';
  stage: 'growing' | 'ripe' | 'fruit' | 'mature' | 'withered' | 'sleeping';
  progress: number;
  dry: boolean;
  waterUntil: number | null;
  /** ước tính lúc chín / ra quả nếu được chăm đủ; null nếu đang dừng */
  readyAt: number | null;
  qualityChance: number;
}

export function view(farm: Farm, now: number, ctx: ActCtx = {}) {
  const f = clone(farm);
  simulate(f, now, ctx);
  settle(f, now, ctx);
  const season = seasonAt(f, now);
  const plots = f.plots.map((p) => {
    if (!p.crop) return { id: p.id, crop: null };
    const c = p.crop;
    const def = CROP_BY_ID[c.cropId];
    const sleeping = def.kind === 'tree' && def.season !== season;
    const dry = !sleeping && (c.lastWateredAt === null || now - c.lastWateredAt > CROP_HEALTH.waterValidMs);
    const fert = fertActive(f, c, now);
    const speed = 1 + (fert ? FERTILIZERS[fert].speed : 0);
    const stage: CropView['stage'] = c.withered ? 'withered' : sleeping ? 'sleeping' : def.kind === 'tree' ? (c.fruitReady ? 'fruit' : c.mature ? 'mature' : 'growing') : c.ripe ? 'ripe' : 'growing';
    const progress = def.kind === 'tree' && c.mature ? c.cycleMs / def.cycleMs! : c.growMs / def.growMs;
    const halted = dry || c.pestSince !== null || c.health <= 0;
    const remain = def.kind === 'tree' && c.mature ? def.cycleMs! - c.cycleMs : def.growMs - c.growMs;
    const readyAt = stage === 'growing' || stage === 'mature' ? (halted ? null : now + c.recoverMs + remain / speed) : null;
    const cv: CropView = { ...c, name: def.name, emoji: def.emoji, kind: def.kind, stage, progress: Math.min(1, progress), dry, waterUntil: c.lastWateredAt === null ? null : c.lastWateredAt + CROP_HEALTH.waterValidMs, readyAt, qualityChance: harvestQualityChance(c.health, fert) };
    return { id: p.id, crop: cv };
  });
  const animals = f.animals.map((x) => {
    const def = ANIMAL_BY_ID[x.species];
    const hungry = x.lastFedAt === null || now - x.lastFedAt > ANIMAL_HEALTH.feedValidMs;
    return {
      ...x,
      name: def.name,
      emoji: def.emoji,
      hungry,
      fedUntil: x.lastFedAt === null ? null : x.lastFedAt + ANIMAL_HEALTH.feedValidMs,
      progress: x.mature ? x.cycleMs / def.cycleMs : x.ageMs / def.matureMs,
      petToday: x.petDay === dayNo(f, now),
      walkToday: x.walkDay === dayNo(f, now),
      sellPrice: animalSellPrice(x),
    };
  });
  const ponds = f.ponds.map((p) => ({
    ...p,
    hungry: p.fish.length > 0 && (p.lastFedAt === null || now - p.lastFedAt > ANIMAL_HEALTH.feedValidMs),
    fedUntil: p.lastFedAt === null ? null : p.lastFedAt + ANIMAL_HEALTH.feedValidMs,
    talkToday: p.talkDay === dayNo(f, now),
    fish: p.fish.map((x) => ({ ...x, name: FISH_BY_ID[x.species].name, emoji: FISH_BY_ID[x.species].emoji, progress: x.ageMs / FISH_BY_ID[x.species].matureMs, mature: x.ageMs >= FISH_BY_ID[x.species].matureMs })),
  }));
  const j = f.job;
  const job = {
    offers: j.offers,
    nextFreeAt: j.nextFreeAt,
    rerollCost: j.rerollCost,
    taken: j.taken,
    perDay: JOBS.perDay,
    last: j.last,
    active: j.active
      ? { id: j.active.id, level: j.active.level, fee: j.active.fee, reward: j.active.reward, idx: j.active.idx, total: j.active.questions.length, deadline: j.active.deadline, question: { text: j.active.questions[j.active.idx].text, options: j.active.questions[j.active.idx].options } }
      : null,
  };
  return {
    now,
    createdAt: f.createdAt,
    coins: f.coins,
    stamina: staminaAt(f, now),
    staminaMax: STAMINA_MAX,
    sleeping: f.sleep !== null,
    season,
    seasonLabel: SEASON_LABEL[season],
    dayInSeason: dayInSeason(f, now),
    year: yearNo(f, now),
    seasonEndsAt: seasonEndsAt(f, now),
    plots,
    buildings: f.buildings,
    animals,
    ponds,
    inventory: f.inventory,
    market: SELLABLES.map((s) => marketRow(f, s.id, now)),
    expansion: {
      plots: { price: plotPrice(f), count: f.plots.length, max: EXPANSION.plotsMax },
      coop: { price: buildPrice(f, 'coop') },
      barn: { price: buildPrice(f, 'barn') },
      pond: { price: buildPrice(f, 'pond') },
    },
    job,
  };
}

export type FarmView = ReturnType<typeof view>;
