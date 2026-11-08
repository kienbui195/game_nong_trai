// Mọi con số cân bằng của game nằm ở đây (bản khởi điểm, xem MyDocs/Games/NongTrai/.../02a-danh-muc-can-bang.md).
// Đổi số ở file này, không phải sửa luật.

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const STEP_MS = 10 * MIN; // bước mô phỏng ở server
export const SEASON_DAYS = 7;
export const MARKET_PERIOD_MS = 4 * HOUR;
export const JOB_REFRESH_MS = 8 * HOUR;
export const ACTION_MEMORY_MS = 10 * MIN; // nhớ mã thao tác để không làm lại (BR30)

export const START = { coins: 500, plots: 6, stamina: 100 };
export const STAMINA_MAX = 100;
export const SLEEP_MS_PER_POINT = 36_000; // +1 thể lực mỗi 36 giây khi ngủ (đầy từ 0 trong 60 phút)

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const SEASON_LABEL: Record<Season, string> = { spring: 'Xuân', summer: 'Hạ', autumn: 'Thu', winter: 'Đông' };

/** Thể lực mỗi việc lao động. Việc không có ở đây thì không tốn thể lực. */
export const STAMINA_COST = {
  plant: 2,
  water: 1,
  fertilize: 1,
  spray: 2,
  harvest: 1,
  clear: 3,
  feed: 1,
  pet: 1,
  walk: 2,
  collect: 1,
  medicate: 1,
  feedPond: 2,
  talkPond: 1,
  medicatePond: 2,
} as const;

export type CropKind = 'short' | 'long' | 'tree';
export interface CropDef {
  id: string;
  name: string;
  emoji: string;
  season: Season;
  kind: CropKind;
  seedPrice: number;
  growMs: number;
  /** cây ăn quả: thời gian giữa hai lần ra quả */
  cycleMs?: number;
  yield: number;
  sellPrice: number;
}

const c = (id: string, name: string, emoji: string, season: Season, kind: CropKind, seedPrice: number, grow: number, yieldN: number, sellPrice: number, cycle?: number): CropDef => ({
  id,
  name,
  emoji,
  season,
  kind,
  seedPrice,
  growMs: grow,
  cycleMs: cycle,
  yield: yieldN,
  sellPrice,
});

export const CROPS: CropDef[] = [
  c('rau_cai', 'Rau cải', '🥬', 'spring', 'short', 10, 3 * HOUR, 1, 24),
  c('xa_lach', 'Xà lách', '🥗', 'spring', 'short', 15, 4 * HOUR, 1, 34),
  c('hanh_la', 'Hành lá', '🧅', 'spring', 'short', 20, 6 * HOUR, 1, 46),
  c('khoai_tay', 'Khoai tây', '🥔', 'spring', 'long', 40, 24 * HOUR, 2, 55),
  c('su_hao', 'Su hào', '🟢', 'spring', 'long', 50, 36 * HOUR, 1, 150),
  c('dau_tay', 'Dâu tây', '🍓', 'spring', 'tree', 300, 4 * DAY, 3, 45, 1 * DAY),
  c('dao', 'Đào', '🍑', 'spring', 'tree', 500, 5 * DAY, 4, 70, 1.5 * DAY),
  c('rau_muong', 'Rau muống', '🌿', 'summer', 'short', 8, 2 * HOUR, 1, 18),
  c('dau_bap', 'Đậu bắp', '🫛', 'summer', 'short', 18, 5 * HOUR, 1, 42),
  c('dua_leo', 'Dưa leo', '🥒', 'summer', 'short', 22, 6 * HOUR, 1, 50),
  c('ngo', 'Ngô', '🌽', 'summer', 'long', 45, 30 * HOUR, 2, 60),
  c('dua_hau', 'Dưa hấu', '🍉', 'summer', 'long', 70, 48 * HOUR, 1, 260),
  c('vai', 'Vải', '🔴', 'summer', 'tree', 450, 5 * DAY, 5, 50, 1.5 * DAY),
  c('xoai', 'Xoài', '🥭', 'summer', 'tree', 600, 6 * DAY, 4, 95, 2 * DAY),
  c('cai_bo_xoi', 'Cải bó xôi', '🍃', 'autumn', 'short', 12, 4 * HOUR, 1, 30),
  c('cu_cai_do', 'Củ cải đỏ', '🫚', 'autumn', 'short', 20, 6 * HOUR, 1, 48),
  c('khoai_lang', 'Khoai lang', '🍠', 'autumn', 'long', 40, 30 * HOUR, 2, 58),
  c('lua', 'Lúa', '🌾', 'autumn', 'long', 30, 60 * HOUR, 3, 45),
  c('bi_ngo', 'Bí ngô', '🎃', 'autumn', 'long', 60, 48 * HOUR, 1, 230),
  c('hong', 'Hồng', '🟠', 'autumn', 'tree', 500, 6 * DAY, 5, 70, 2 * DAY),
  c('buoi', 'Bưởi', '🍈', 'autumn', 'tree', 650, 7 * DAY, 3, 140, 2 * DAY),
  c('rau_mui', 'Rau mùi', '🌱', 'winter', 'short', 10, 3 * HOUR, 1, 25),
  c('cai_thao', 'Cải thảo', '🥬', 'winter', 'short', 18, 5 * HOUR, 1, 44),
  c('ca_rot', 'Cà rốt', '🥕', 'winter', 'long', 35, 24 * HOUR, 2, 50),
  c('bap_cai', 'Bắp cải', '🥦', 'winter', 'long', 55, 36 * HOUR, 1, 160),
  c('quyt', 'Quýt', '🍊', 'winter', 'tree', 450, 5 * DAY, 5, 50, 1.5 * DAY),
  c('cam', 'Cam', '🍊', 'winter', 'tree', 550, 6 * DAY, 4, 80, 2 * DAY),
];
/** Bảng tra theo mã người chơi gửi lên: không có prototype, nên "__proto__", "toString"… tra ra undefined. */
export const table = <T>(entries: Iterable<readonly [string, T]>): Record<string, T> => Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(entries));

export const CROP_BY_ID: Record<string, CropDef> = table(CROPS.map((x) => [x.id, x] as const));

export type BuildingType = 'coop' | 'barn' | 'pond';
export interface AnimalDef {
  id: string;
  name: string;
  emoji: string;
  building: 'coop' | 'barn';
  price: number;
  matureMs: number;
  product: string;
  productName: string;
  productEmoji: string;
  productQty: number;
  cycleMs: number;
  productPrice: number;
}
const a = (id: string, name: string, emoji: string, building: 'coop' | 'barn', price: number, mature: number, product: string, productName: string, productEmoji: string, qty: number, cycle: number, productPrice: number): AnimalDef => ({
  id,
  name,
  emoji,
  building,
  price,
  matureMs: mature,
  product,
  productName,
  productEmoji,
  productQty: qty,
  cycleMs: cycle,
  productPrice,
});
export const ANIMALS: AnimalDef[] = [
  a('ga', 'Gà', '🐔', 'coop', 200, 24 * HOUR, 'trung_ga', 'Trứng gà', '🥚', 1, 24 * HOUR, 40),
  a('vit', 'Vịt', '🦆', 'coop', 260, 30 * HOUR, 'trung_vit', 'Trứng vịt', '🥚', 1, 24 * HOUR, 55),
  a('cut', 'Chim cút', '🐦', 'coop', 120, 18 * HOUR, 'trung_cut', 'Trứng cút', '🥚', 3, 24 * HOUR, 12),
  a('de', 'Dê', '🐐', 'barn', 800, 60 * HOUR, 'sua_de', 'Sữa dê', '🥛', 1, 36 * HOUR, 150),
  a('bo', 'Bò', '🐄', 'barn', 1200, 72 * HOUR, 'sua_bo', 'Sữa bò', '🥛', 1, 24 * HOUR, 160),
  a('cuu', 'Cừu', '🐑', 'barn', 900, 72 * HOUR, 'long_cuu', 'Lông cừu', '🧶', 1, 72 * HOUR, 420),
];
export const ANIMAL_BY_ID: Record<string, AnimalDef> = table(ANIMALS.map((x) => [x.id, x] as const));

export interface FishDef {
  id: string;
  name: string;
  emoji: string;
  price: number;
  matureMs: number;
  sellPrice: number;
}
export const FISH: FishDef[] = [
  { id: 'ro_phi', name: 'Cá rô phi', emoji: '🐟', price: 20, matureMs: 36 * HOUR, sellPrice: 70 },
  { id: 'chep', name: 'Cá chép', emoji: '🐠', price: 40, matureMs: 48 * HOUR, sellPrice: 130 },
  { id: 'loc', name: 'Cá lóc', emoji: '🐡', price: 60, matureMs: 60 * HOUR, sellPrice: 210 },
  { id: 'tram', name: 'Cá trắm', emoji: '🐋', price: 80, matureMs: 72 * HOUR, sellPrice: 280 },
];
export const FISH_BY_ID: Record<string, FishDef> = table(FISH.map((x) => [x.id, x] as const));

export type FertilizerId = 'cheap' | 'normal' | 'good';
export const FERTILIZERS: Record<FertilizerId, { name: string; price: number; speed: number; quality: number }> = table(Object.entries({
  cheap: { name: 'Phân giá rẻ', price: 5, speed: 0.1, quality: 0.01 },
  normal: { name: 'Phân thường', price: 15, speed: 0.2, quality: 0.03 },
  good: { name: 'Phân loại tốt', price: 40, speed: 0.3, quality: 0.05 },
}));

/** Đồ bán ở cửa hàng (giá cố định), ngoài hạt giống / cây con. */
export const SUPPLIES: Record<string, { name: string; emoji: string; price: number }> = table(Object.entries({
  'feed:poultry': { name: 'Thức ăn gia cầm', emoji: '🌾', price: 5 },
  'feed:livestock': { name: 'Thức ăn gia súc', emoji: '🌿', price: 15 },
  'feed:fish': { name: 'Thức ăn cá', emoji: '🦐', price: 20 },
  'fert:cheap': { name: 'Phân giá rẻ', emoji: '💩', price: 5 },
  'fert:normal': { name: 'Phân thường', emoji: '🧪', price: 15 },
  'fert:good': { name: 'Phân loại tốt', emoji: '✨', price: 40 },
  'med:pest': { name: 'Thuốc trừ sâu', emoji: '🧴', price: 25 },
  'med:poultry': { name: 'Thuốc gia cầm', emoji: '💊', price: 40 },
  'med:livestock': { name: 'Thuốc gia súc', emoji: '💉', price: 120 },
  'med:fish': { name: 'Thuốc cá', emoji: '🧫', price: 60 },
}));

export const CROP_HEALTH = {
  start: 80,
  wateredPerHour: 2,
  dryPerHour: -4,
  pestPerHour: -3,
  recoverPerHour: 5,
  waterValidMs: DAY,
  pestChancePerHour: 0.02,
  pestChanceStressedPerHour: 0.04,
  stressedBelow: 50,
  earlySprayMs: 2 * HOUR,
  maxRecoverMs: DAY,
  qualityMax: 0.15,
};

export const ANIMAL_HEALTH = {
  start: 80,
  fedPerHour: 2,
  hungryPerHour: -3,
  sickBelow: 30,
  afterMedicine: 50,
  feedValidMs: DAY,
  affectionStart: 20,
  pet: 10,
  walk: 15,
  idleDayPenalty: 5,
};

export const QUALITY_CAP = 0.2;
export const HQ_MULTIPLIER = 1.5;

export const MARKET = {
  minFactor: 0.7,
  maxFactor: 1.3,
  inSeason: 0.85,
  offSeason: 1.15,
  dropPerUnit: 0.01,
  maxDrop: 0.3,
  recoverPerHour: 0.05,
  flatBelow: 0.03,
};

export const EXPANSION = {
  plotsPerBuy: 3,
  plotsMax: 30,
  plotFirstPrice: 300,
  build: table(Object.entries({
    coop: { prices: [800, 2000], capacity: 6, upgradePrice: 1500, upgradeAdd: 6, label: 'Chuồng gia cầm' },
    barn: { prices: [2500, 5000], capacity: 4, upgradePrice: 4000, upgradeAdd: 4, label: 'Chuồng gia súc' },
    pond: { prices: [1500, 3000], capacity: 10, upgradePrice: 2500, upgradeAdd: 10, label: 'Ao cá' },
  })) as Record<BuildingType, { prices: number[]; capacity: number; upgradePrice: number; upgradeAdd: number; label: string }>,
};

export type JobLevel = 1 | 2 | 3;
export const JOBS = {
  offers: 3,
  questionsPerJob: 10,
  perDay: 6,
  rerollFirst: 15,
  /** totalMs: thời gian cho CẢ đề 10 câu (không tính riêng từng câu), hết giờ là thất bại. */
  levels: {
    1: { label: 'Dễ', fee: [5, 10], reward: [100, 150], totalMs: 200_000 },
    2: { label: 'Vừa', fee: [10, 20], reward: [150, 250], totalMs: 250_000 },
    3: { label: 'Khó', fee: [20, 30], reward: [250, 350], totalMs: 300_000 },
  } as Record<JobLevel, { label: string; fee: [number, number]; reward: [number, number]; totalMs: number }>,
  seenMemory: 120,
};
