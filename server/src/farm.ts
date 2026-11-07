import { randomInt } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { act, advance, newFarm, view, type Action, type ActCtx, type Farm, type GameError, type JobLevel } from '../../core/src';
import { levelCounts, pickQuestions } from './questions';

const ACTION_TYPES = new Set([
  'sleep', 'wake', 'plant', 'water', 'fertilize', 'spray', 'harvest', 'clear', 'buyAnimal', 'feed', 'pet', 'walk', 'collect', 'medicate',
  'sellAnimal', 'buyFish', 'feedPond', 'talkPond', 'medicatePond', 'sellFish', 'buy', 'sell', 'expand', 'upgrade', 'rerollJobs', 'acceptJob', 'answer',
]);

export interface ActOutcome {
  ok: boolean;
  error?: GameError;
  replay?: boolean;
  view: ReturnType<typeof view>;
}

/** Đọc - tính bù - làm - lưu nông trại của một người, trong một giao dịch có khoá dòng (BR3, BR30). */
export class FarmService {
  constructor(private pool: Pool, private clock: () => number = Date.now) {}

  private async withFarm<T>(userId: number, fn: (conn: PoolConnection, farm: Farm, now: number) => Promise<{ farm: Farm; result: T }>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<RowDataPacket[]>('SELECT state FROM farms WHERE user_id = ? FOR UPDATE', [userId]);
      const now = this.clock();
      let farm: Farm;
      if (rows[0]) farm = JSON.parse(String(rows[0].state));
      else {
        farm = newFarm(now, randomInt(2 ** 31), { levelCounts: await levelCounts(conn) });
        await conn.query('INSERT INTO farms (user_id, state, sim_at) VALUES (?, ?, ?)', [userId, JSON.stringify(farm), farm.simAt]);
      }
      const out = await fn(conn, farm, now);
      await conn.query('UPDATE farms SET state = ?, sim_at = ?, version = version + 1 WHERE user_id = ?', [JSON.stringify(out.farm), out.farm.simAt, userId]);
      await conn.commit();
      return out.result;
    } catch (e) {
      await conn.rollback().catch(() => undefined);
      throw e;
    } finally {
      conn.release();
    }
  }

  /** Mở game: tính bù tới bây giờ, lưu lại, trả dữ liệu cho giao diện (không có đáp án). */
  async get(userId: number) {
    return this.withFarm(userId, async (conn, farm, now) => {
      const ctx: ActCtx = { levelCounts: await levelCounts(conn) };
      const f = advance(farm, now, ctx);
      return { farm: f, result: view(f, now, ctx) };
    });
  }

  async act(userId: number, actionId: unknown, action: unknown): Promise<ActOutcome> {
    if (typeof actionId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(actionId)) throw new BadAction('Thiếu mã thao tác.');
    if (!action || typeof action !== 'object' || !ACTION_TYPES.has(String((action as { type?: unknown }).type))) throw new BadAction('Thao tác không hợp lệ.');
    const a = action as Action;
    return this.withFarm(userId, async (conn, farm, now) => {
      const ctx: ActCtx = { levelCounts: await levelCounts(conn) };
      if (a.type === 'acceptJob') {
        const offer = advance(farm, now, ctx).job.offers.find((o) => o.id === a.offerId);
        if (offer) ctx.questions = await pickQuestions(conn, offer.level as JobLevel, farm.job.seen);
      }
      const r = act(farm, a, now, ctx, actionId);
      return { farm: r.farm, result: { ok: !r.error, ...(r.error ? { error: r.error } : {}), ...(r.replay ? { replay: true } : {}), view: view(r.farm, now, ctx) } };
    });
  }
}

export class BadAction extends Error {}
