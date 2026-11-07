import type { BuildingType, FertilizerId, JobLevel } from './config';

export const SCHEMA_VERSION = 1;

export interface CropState {
  cropId: string;
  plantedAt: number;
  growMs: number;
  health: number;
  lastWateredAt: number | null;
  fertilizer: FertilizerId | null;
  /** cây ăn quả: phân bón chỉ có tác dụng trong mùa (số thứ tự mùa tuyệt đối) đã bón */
  fertilizedSeasonNo: number | null;
  pestSince: number | null;
  recoverMs: number;
  ripe: boolean; // cây thu một lần: đã chín
  mature: boolean; // cây ăn quả: đã lớn xong
  cycleMs: number;
  fruitReady: boolean;
  withered: boolean;
}

export interface Plot {
  id: number; // = vị trí slot trên bản đồ
  crop: CropState | null;
}

export interface Building {
  id: number;
  type: BuildingType;
  slot: number;
  capacity: number;
  upgraded: boolean;
}

export interface Animal {
  id: number;
  species: string;
  buildingId: number;
  boughtAt: number;
  ageMs: number;
  mature: boolean;
  health: number;
  affection: number;
  lastFedAt: number | null;
  sick: boolean;
  cycleMs: number;
  product: { qty: number; hq: boolean } | null;
  petDay: number;
  walkDay: number;
  lastInteractDay: number;
}

export interface Fish {
  id: number;
  species: string;
  ageMs: number;
}

export interface PondState {
  buildingId: number;
  fish: Fish[];
  health: number;
  affection: number;
  lastFedAt: number | null;
  sick: boolean;
  talkDay: number;
  lastInteractDay: number;
}

export interface Stack {
  n: number;
  hq: number;
}

export interface JobOffer {
  id: number;
  level: JobLevel;
  fee: number;
  reward: number;
}

export interface JobQuestion {
  id: number;
  text: string;
  options: string[];
  /** chỉ số đáp án đúng trong options; KHÔNG BAO GIỜ gửi xuống máy */
  correct: number;
}

export interface ActiveJob extends JobOffer {
  questions: JobQuestion[];
  idx: number;
  deadline: number;
}

export interface JobResult {
  ok: boolean;
  level: JobLevel;
  fee: number;
  reward: number;
  answered: number;
  reason?: 'wrong' | 'timeout';
  /** câu bị sai: nội dung + đáp án đúng để người chơi xem */
  missed?: { text: string; answer: string };
  at: number;
}

export interface JobState {
  offers: JobOffer[];
  nextFreeAt: number;
  rerollCost: number;
  day: number;
  taken: number;
  active: ActiveJob | null;
  last: JobResult | null;
  seen: number[];
  /** lần tạo việc gần nhất không có mức nào đủ câu: có câu thì tạo lại ngay, không chờ 8 giờ */
  emptyBank: boolean;
}

export interface RecentAction {
  id: string;
  at: number;
  error: GameError | null;
}

export interface Farm {
  schemaVersion: number;
  seed: number;
  createdAt: number;
  simAt: number;
  coins: number;
  stamina: number;
  sleep: { since: number; base: number } | null;
  plots: Plot[];
  plotBuys: number;
  buildings: Building[];
  animals: Animal[];
  ponds: PondState[];
  inventory: Record<string, Stack>;
  market: Record<string, { drop: number; at: number }>;
  job: JobState;
  recent: RecentAction[];
  nextId: number;
  actCounter: number;
}

export interface GameError {
  code: string;
  message: string;
  /** dữ liệu kèm theo (vd giá mới khi giá đã đổi) */
  data?: Record<string, unknown>;
}

export type Action =
  | { type: 'sleep' }
  | { type: 'wake' }
  | { type: 'plant'; plotId: number; cropId: string; confirmLate?: boolean }
  | { type: 'water'; plotId: number }
  | { type: 'fertilize'; plotId: number; fertilizer: FertilizerId }
  | { type: 'spray'; plotId: number }
  | { type: 'harvest'; plotId: number }
  | { type: 'clear'; plotId: number }
  | { type: 'buyAnimal'; species: string; buildingId: number }
  | { type: 'feed'; animalId: number }
  | { type: 'pet'; animalId: number }
  | { type: 'walk'; animalId: number }
  | { type: 'collect'; animalId: number }
  | { type: 'medicate'; animalId: number }
  | { type: 'sellAnimal'; animalId: number }
  | { type: 'buyFish'; buildingId: number; species: string; n: number }
  | { type: 'feedPond'; buildingId: number }
  | { type: 'talkPond'; buildingId: number }
  | { type: 'medicatePond'; buildingId: number }
  | { type: 'sellFish'; buildingId: number; fishId: number; expected?: number }
  | { type: 'buy'; itemId: string; n: number }
  | { type: 'sell'; itemId: string; n: number; hq: boolean; expected: number }
  | { type: 'expand'; what: 'plots' | BuildingType }
  | { type: 'upgrade'; buildingId: number }
  | { type: 'rerollJobs' }
  | { type: 'acceptJob'; offerId: number }
  | { type: 'answer'; idx: number; choice: number };

export type ActionType = Action['type'];

/** Danh sách loại thao tác (server dùng để chặn thao tác lạ). */
export const ACTION_TYPES: readonly ActionType[] = [
  'sleep', 'wake', 'plant', 'water', 'fertilize', 'spray', 'harvest', 'clear', 'buyAnimal', 'feed', 'pet', 'walk', 'collect', 'medicate',
  'sellAnimal', 'buyFish', 'feedPond', 'talkPond', 'medicatePond', 'sellFish', 'buy', 'sell', 'expand', 'upgrade', 'rerollJobs', 'acceptJob', 'answer',
];

/** Dữ liệu server cấp thêm cho lõi luật (lõi luật không đọc DB). */
export interface ActCtx {
  /** số câu hỏi đang có theo độ khó 1/2/3 */
  levelCounts?: Partial<Record<JobLevel, number>>;
  /** 10 câu server đã chọn cho việc sắp nhận */
  questions?: JobQuestion[];
  /** chỉ dùng trong test: tắt sâu bệnh ngẫu nhiên */
  noPests?: boolean;
}
