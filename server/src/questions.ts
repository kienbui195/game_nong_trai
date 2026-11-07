import { createHash, randomInt } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { JobLevel, JobQuestion } from '../../core/src';

/** Cột CSV và tên trường quản trị: giống hệt Căn Góc Toạ Độ (BR28). */
export const CSV_HEADER = ['do_kho', 'cau_hoi', 'dap_an_a', 'dap_an_b', 'dap_an_c', 'dap_an_d', 'dap_an_dung'] as const;
export const LETTERS = ['A', 'B', 'C', 'D'] as const;

export interface QuestionInput {
  difficulty: number;
  text: string;
  options: [string, string, string, string];
  correct: string; // A-D
}

export interface FieldError {
  name: string;
  message: string;
}

const clean = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim() : '');

/** Chuẩn hoá nội dung câu để so trùng: bỏ khoảng trắng thừa, không phân biệt hoa thường. */
export const textHash = (text: string) => createHash('sha256').update(clean(text).toLowerCase()).digest('hex');

/** Kiểm một dòng theo tên cột CSV. Trả câu hỏi hợp lệ hoặc danh sách lỗi theo cột. */
export function validateRow(v: Record<string, unknown>): { q?: QuestionInput; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const diff = clean(v.do_kho);
  if (!['1', '2', '3'].includes(diff)) errors.push({ name: 'do_kho', message: 'Độ khó phải là 1, 2 hoặc 3.' });
  const text = clean(v.cau_hoi);
  if (text.length < 1 || text.length > 500) errors.push({ name: 'cau_hoi', message: 'Câu hỏi cần 1–500 ký tự.' });
  const opts = (['dap_an_a', 'dap_an_b', 'dap_an_c', 'dap_an_d'] as const).map((k) => clean(v[k]));
  opts.forEach((o, i) => {
    if (o.length < 1 || o.length > 200) errors.push({ name: `dap_an_${'abcd'[i]}`, message: 'Đáp án cần 1–200 ký tự.' });
  });
  if (opts.every((o) => o) && new Set(opts.map((o) => o.toLowerCase())).size < 4) errors.push({ name: 'dap_an_a', message: 'Bốn đáp án phải khác nhau.' });
  const correct = clean(v.dap_an_dung).toUpperCase();
  if (!LETTERS.includes(correct as (typeof LETTERS)[number])) errors.push({ name: 'dap_an_dung', message: 'Đáp án đúng phải là A, B, C hoặc D.' });
  if (errors.length) return { errors };
  return { q: { difficulty: Number(diff), text, options: opts as QuestionInput['options'], correct }, errors };
}

export type Db = Pool | PoolConnection;

export async function levelCounts(db: Db): Promise<Partial<Record<JobLevel, number>>> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT difficulty AS d, COUNT(*) AS n FROM questions GROUP BY difficulty');
  return Object.fromEntries(rows.map((r) => [Number(r.d), Number(r.n)]));
}

/** Chọn 10 câu của một độ khó, ưu tiên câu người chơi chưa gặp gần đây; xáo thứ tự đáp án. */
export async function pickQuestions(db: Db, level: JobLevel, seen: number[], n = 10): Promise<JobQuestion[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, text, option_a, option_b, option_c, option_d, correct FROM questions WHERE difficulty = ? ORDER BY RAND() LIMIT 200',
    [level],
  );
  const seenSet = new Set(seen);
  const ordered = [...rows.filter((r) => !seenSet.has(Number(r.id))), ...rows.filter((r) => seenSet.has(Number(r.id)))].slice(0, n);
  return ordered.map((r) => {
    const opts = [r.option_a, r.option_b, r.option_c, r.option_d].map(String);
    const right = opts[LETTERS.indexOf(String(r.correct) as (typeof LETTERS)[number])];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { id: Number(r.id), text: String(r.text), options: opts, correct: opts.indexOf(right) };
  });
}
