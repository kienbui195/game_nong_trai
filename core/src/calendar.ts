import { DAY, SEASONS, SEASON_DAYS, type Season } from './config';
import type { Farm } from './types';

/** Ngày game thứ mấy (0 = ngày đầu) — mỗi người chơi một lịch riêng (Q25). */
export const dayNo = (f: Pick<Farm, 'createdAt'>, t: number) => Math.floor((t - f.createdAt) / DAY);
/** Mùa thứ mấy tính từ đầu (0 = Xuân năm 1, 4 = Xuân năm 2). */
export const seasonNo = (f: Pick<Farm, 'createdAt'>, t: number) => Math.floor(dayNo(f, t) / SEASON_DAYS);
export const seasonAt = (f: Pick<Farm, 'createdAt'>, t: number): Season => SEASONS[seasonNo(f, t) % 4];
/** Mốc kết thúc mùa đang chạy. */
export const seasonEndsAt = (f: Pick<Farm, 'createdAt'>, t: number) => f.createdAt + (seasonNo(f, t) + 1) * SEASON_DAYS * DAY;
export const dayInSeason = (f: Pick<Farm, 'createdAt'>, t: number) => (dayNo(f, t) % SEASON_DAYS) + 1;
export const yearNo = (f: Pick<Farm, 'createdAt'>, t: number) => Math.floor(seasonNo(f, t) / 4) + 1;
