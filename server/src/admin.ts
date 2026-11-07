// /admin-api: hợp đồng quản trị v1 của trang quản trị chung (admin.baodom.xyz).
// Trang quản trị gọi thẳng trong mạng Docker; Caddy/Cloudflare không bao giờ chuyển /admin-api ra internet.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpException, Inject, Injectable, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { config } from './config';
import { toCsv, parseCsv } from './csv';
import { POOL } from './db';
import { CSV_HEADER, textHash, validateRow, type FieldError } from './questions';

const CONTRACT_VERSION = 1;
const GAME = { key: 'nongtrai', name: 'Nông Trại Xu', version: config.version };
const MAX_IMPORT_ROWS = 5000;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const PREVIEW_TTL_MS = 10 * 60_000;

const bad = (status: number, code: string, message: string, fields?: FieldError[]) => new HttpException({ error: { code, message, ...(fields ? { fields } : {}) } }, status);

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const expected = Buffer.from(config.adminApiToken);
    if (expected.length < 32) throw bad(401, 'unauthorized', 'Chưa cấu hình token quản trị.');
    if (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) throw bad(401, 'unauthorized', 'Không nhận yêu cầu đi qua proxy.');
    const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw bad(401, 'unauthorized', 'Sai hoặc thiếu token.');
    return true;
  }
}

const f = (name: string, label: string, type: string, extra: Record<string, unknown> = {}) => ({
  name,
  label,
  type,
  required: false,
  unique: false,
  readonly: false,
  list: true,
  filter: false,
  search: false,
  sortable: false,
  ...extra,
});

export const META = {
  game: GAME,
  contractVersion: CONTRACT_VERSION,
  resources: [
    {
      key: 'questions',
      label: 'Câu hỏi',
      kind: 'collection',
      primaryKey: 'id',
      allowCreate: true,
      allowDelete: true,
      actions: [],
      import: { formats: ['csv', 'json'], matchKey: 'cau_hoi' },
      description: 'Câu hỏi cho việc làm thêm. Cột CSV giống Căn Góc Toạ Độ: do_kho (1 dễ, 2 trung bình, 3 khó), cau_hoi, dap_an_a…d, dap_an_dung (A–D). Nhập trùng nội dung câu thì cập nhật.',
      fields: [
        f('id', 'ID', 'int', { unique: true, readonly: true, sortable: true }),
        f('do_kho', 'Độ khó', 'enum', { required: true, enum: ['1', '2', '3'], filter: true, sortable: true, hint: '1 dễ, 2 trung bình, 3 khó' }),
        f('cau_hoi', 'Câu hỏi', 'text', { required: true, unique: true, search: true, maxLength: 500 }),
        f('dap_an_a', 'Đáp án A', 'string', { required: true, maxLength: 200, list: false }),
        f('dap_an_b', 'Đáp án B', 'string', { required: true, maxLength: 200, list: false }),
        f('dap_an_c', 'Đáp án C', 'string', { required: true, maxLength: 200, list: false }),
        f('dap_an_d', 'Đáp án D', 'string', { required: true, maxLength: 200, list: false }),
        f('dap_an_dung', 'Đáp án đúng', 'enum', { required: true, enum: ['A', 'B', 'C', 'D'] }),
        f('updatedAt', 'Cập nhật', 'datetime', { readonly: true, sortable: true }),
      ],
    },
    {
      key: 'players',
      label: 'Người chơi',
      kind: 'collection',
      primaryKey: 'id',
      allowCreate: false,
      allowDelete: true,
      allowEdit: false,
      actions: [],
      fields: [
        f('id', 'ID', 'int', { unique: true, readonly: true, sortable: true }),
        f('username', 'Tên đăng nhập', 'string', { unique: true, readonly: true, search: true, sortable: true }),
        f('displayName', 'Tên hiển thị', 'string', { readonly: true, search: true, sortable: true }),
        f('coins', 'Xu', 'int', { readonly: true }),
        f('createdAt', 'Ngày tạo', 'datetime', { readonly: true, sortable: true }),
      ],
    },
  ],
};

const Q_SELECT =
  'SELECT id, CAST(difficulty AS CHAR) AS do_kho, text AS cau_hoi, option_a AS dap_an_a, option_b AS dap_an_b, option_c AS dap_an_c, option_d AS dap_an_d, correct AS dap_an_dung, updated_at AS updatedAt FROM questions';
const Q_SORT: Record<string, string> = { id: 'id', do_kho: 'difficulty', updatedAt: 'updated_at' };
const P_SELECT =
  "SELECT u.id, u.username, u.display_name AS displayName, CAST(JSON_EXTRACT(f.state, '$.coins') AS UNSIGNED) AS coins, u.created_at AS createdAt FROM users u LEFT JOIN farms f ON f.user_id = u.id";
const P_SORT: Record<string, string> = { id: 'u.id', username: 'u.username', displayName: 'u.display_name', createdAt: 'u.created_at' };

interface ImportBody {
  format?: string;
  content?: unknown;
  matchKey?: string;
  previewToken?: string;
}

@Controller('admin-api')
@UseGuards(AdminTokenGuard)
export class AdminApiController {
  constructor(@Inject(POOL) private pool: Pool) {}

  @Get('meta')
  meta() {
    return META;
  }

  @Get('health')
  async health() {
    let db: 'up' | 'down' = 'up';
    try {
      await this.pool.query('SELECT 1');
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'error', version: GAME.version, contractVersion: CONTRACT_VERSION, uptimeSec: Math.round(process.uptime()), rssMb: Math.round(process.memoryUsage().rss / 1048576), db };
  }

  // ---------------------------------------------------------------- nhập / xuất (khai báo trước :id)

  @Post(':resource/import')
  async import(@Param('resource') resource: string, @Query('dryRun') dryRunQ: string | undefined, @Body() body: ImportBody) {
    this.need(resource, 'questions');
    const dryRun = dryRunQ !== 'false';
    if (body?.format !== 'csv' && body?.format !== 'json') throw bad(422, 'validation', 'Định dạng phải là csv hoặc json.');
    if (typeof body.content !== 'string' || !body.content) throw bad(422, 'validation', 'File rỗng.');
    if (Buffer.byteLength(body.content) > MAX_IMPORT_BYTES) throw bad(413, 'too_large', 'File vượt quá 5MB.');
    if (body.matchKey && body.matchKey !== 'cau_hoi') throw bad(422, 'validation', 'Chỉ đối chiếu được theo cột cau_hoi.');
    const rows = this.readRows(body.format, body.content);
    if (!dryRun) this.verifyPreview(body.content, body.previewToken);

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const report = { dryRun, willCreate: 0, willUpdate: 0, unchanged: 0, rejected: [] as { row: number; field: string; message: string }[], ignoredColumns: rows.ignored };
      const seen = new Map<string, number>();
      for (const r of rows.items) {
        const { q, errors } = validateRow(r.values);
        if (!q) {
          for (const e of errors) report.rejected.push({ row: r.row, field: e.name, message: e.message });
          continue;
        }
        const hash = textHash(q.text);
        const dup = seen.get(hash);
        if (dup !== undefined) {
          report.rejected.push({ row: r.row, field: 'cau_hoi', message: `Trùng câu hỏi với dòng ${dup} trong cùng file.` });
          continue;
        }
        seen.set(hash, r.row);
        const [ex] = await conn.query<RowDataPacket[]>('SELECT id, difficulty, text, option_a, option_b, option_c, option_d, correct FROM questions WHERE text_hash = ?', [hash]);
        const cur = ex[0];
        const vals = [q.difficulty, q.text, ...q.options, q.correct];
        if (cur && [cur.difficulty, cur.text, cur.option_a, cur.option_b, cur.option_c, cur.option_d, cur.correct].map(String).join('\u0001') === vals.map(String).join('\u0001')) {
          report.unchanged++;
        } else if (cur) {
          report.willUpdate++;
          if (!dryRun) await conn.query('UPDATE questions SET difficulty=?, text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct=? WHERE id=?', [...vals, cur.id]);
        } else {
          report.willCreate++;
          if (!dryRun) await conn.query('INSERT INTO questions (difficulty, text, option_a, option_b, option_c, option_d, correct, text_hash) VALUES (?,?,?,?,?,?,?,?)', [...vals, hash]);
        }
      }
      if (dryRun) {
        await conn.rollback();
        return { ...report, previewToken: this.signPreview(body.content) };
      }
      await conn.commit(); // ghi trong một giao dịch: lỗi giữa chừng thì không dòng nào được ghi
      return report;
    } catch (e) {
      await conn.rollback().catch(() => undefined);
      throw e;
    } finally {
      conn.release();
    }
  }

  @Get(':resource/export')
  async export(@Param('resource') resource: string, @Query('format') format = 'csv') {
    if (format !== 'csv' && format !== 'json') throw bad(422, 'validation', 'format phải là csv hoặc json.');
    const stamp = new Date().toISOString().slice(0, 10);
    if (resource === 'questions') {
      const [rows] = await this.pool.query<RowDataPacket[]>(`${Q_SELECT} ORDER BY id`);
      const content =
        format === 'csv'
          ? toCsv([[...CSV_HEADER], ...rows.map((r) => CSV_HEADER.map((h) => r[h]))])
          : JSON.stringify(rows.map((r) => Object.fromEntries(CSV_HEADER.map((h) => [h, r[h]]))), null, 2);
      return { format, filename: `cau-hoi-nongtrai-${stamp}.${format}`, count: rows.length, content };
    }
    this.need(resource, 'players');
    const [rows] = await this.pool.query<RowDataPacket[]>(`${P_SELECT} ORDER BY u.id`);
    const cols = ['id', 'username', 'displayName', 'coins', 'createdAt'];
    const content = format === 'csv' ? toCsv([cols, ...rows.map((r) => cols.map((c) => r[c]))]) : JSON.stringify(rows, null, 2);
    return { format, filename: `nguoi-choi-${stamp}.${format}`, count: rows.length, content };
  }

  // ---------------------------------------------------------------- danh sách, xem, thêm, sửa, xoá

  @Get(':resource')
  async list(@Param('resource') resource: string, @Query() q: Record<string, unknown>) {
    const isQ = resource === 'questions';
    if (!isQ) this.need(resource, 'players');
    const page = Math.max(1, Math.floor(Number(q.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize)) || 20));
    const [sortField, dir] = String(q.sort ?? 'id:desc').split(':');
    const column = (isQ ? Q_SORT : P_SORT)[sortField];
    if (!column) throw bad(422, 'validation', `Không sắp xếp được theo "${sortField}".`);
    const where: string[] = [];
    const args: unknown[] = [];
    const term = typeof q.q === 'string' ? q.q.trim() : '';
    if (term) {
      if (isQ) where.push('text LIKE ?');
      else where.push('(u.username LIKE ? OR u.display_name LIKE ?)');
      args.push(`%${term}%`, ...(isQ ? [] : [`%${term}%`]));
    }
    const filter = (q.filter ?? {}) as Record<string, unknown>;
    const level = filter.do_kho ?? q['filter[do_kho]'];
    if (isQ && level !== undefined && level !== '') {
      if (!['1', '2', '3'].includes(String(level))) throw bad(422, 'validation', 'Độ khó phải là 1, 2 hoặc 3.');
      where.push('difficulty = ?');
      args.push(Number(level));
    }
    const w = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const from = isQ ? 'FROM questions' : 'FROM users u';
    const [[count]] = await this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from}${w}`, args);
    const [items] = await this.pool.query<RowDataPacket[]>(`${isQ ? Q_SELECT : P_SELECT}${w} ORDER BY ${column} ${dir === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`, [...args, pageSize, (page - 1) * pageSize]);
    return { items, total: Number(count.n), page, pageSize };
  }

  @Get(':resource/:id')
  async one(@Param('resource') resource: string, @Param('id') id: string) {
    return this.find(resource, id);
  }

  @Post(':resource')
  async create(@Param('resource') resource: string, @Body() body: Record<string, unknown>) {
    this.need(resource, 'questions');
    const q = this.validOrThrow(body);
    try {
      const [r] = await this.pool.execute<ResultSetHeader>('INSERT INTO questions (difficulty, text, option_a, option_b, option_c, option_d, correct, text_hash) VALUES (?,?,?,?,?,?,?,?)', [
        q.difficulty,
        q.text,
        ...q.options,
        q.correct,
        textHash(q.text),
      ]);
      return this.find('questions', String(r.insertId));
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY') throw bad(409, 'conflict', 'Đã có câu hỏi này.', [{ name: 'cau_hoi', message: 'Trùng nội dung với câu đã có.' }]);
      throw e;
    }
  }

  @Put(':resource/:id')
  async update(@Param('resource') resource: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.need(resource, 'questions');
    await this.find('questions', id);
    const q = this.validOrThrow(body);
    try {
      await this.pool.execute('UPDATE questions SET difficulty=?, text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct=?, text_hash=? WHERE id=?', [
        q.difficulty,
        q.text,
        ...q.options,
        q.correct,
        textHash(q.text),
        id,
      ]);
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY') throw bad(409, 'conflict', 'Đã có câu hỏi này.', [{ name: 'cau_hoi', message: 'Trùng nội dung với câu đã có.' }]);
      throw e;
    }
    return this.find('questions', id);
  }

  @Delete(':resource/:id')
  async remove(@Param('resource') resource: string, @Param('id') id: string) {
    const table = resource === 'questions' ? 'questions' : resource === 'players' ? 'users' : null;
    if (!table) throw bad(404, 'not_found', `Không có tài nguyên "${resource}".`);
    if (!/^\d+$/.test(id)) throw bad(404, 'not_found', 'Không có bản ghi này.');
    const [r] = await this.pool.execute<ResultSetHeader>(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (!r.affectedRows) throw bad(404, 'not_found', 'Không có bản ghi này.');
    return { ok: true };
  }

  // ---------------------------------------------------------------- phụ

  private need(resource: string, want: string) {
    if (resource !== want) throw bad(404, 'not_found', `Không có tài nguyên "${resource}".`);
  }

  private async find(resource: string, id: string) {
    const isQ = resource === 'questions';
    if (!isQ) this.need(resource, 'players');
    if (!/^\d+$/.test(id)) throw bad(404, 'not_found', 'Không có bản ghi này.');
    const [rows] = await this.pool.query<RowDataPacket[]>(`${isQ ? Q_SELECT : P_SELECT} WHERE ${isQ ? 'id' : 'u.id'} = ?`, [id]);
    if (!rows[0]) throw bad(404, 'not_found', 'Không có bản ghi này.');
    return rows[0];
  }

  private validOrThrow(body: Record<string, unknown>) {
    const { q, errors } = validateRow(body ?? {});
    if (!q) throw bad(422, 'validation', 'Dữ liệu chưa hợp lệ.', errors);
    return q;
  }

  private readRows(format: 'csv' | 'json', content: string) {
    let items: { row: number; values: Record<string, unknown> }[];
    let columns: string[];
    if (format === 'csv') {
      let table: string[][];
      try {
        table = parseCsv(content);
      } catch (e) {
        throw bad(422, 'validation', (e as Error).message);
      }
      if (table.length < 2) throw bad(422, 'validation', 'File không có dòng dữ liệu nào.');
      columns = table[0].map((h) => h.trim().toLowerCase());
      items = table.slice(1).map((cells, i) => ({ row: i + 2, values: Object.fromEntries(columns.map((c, ci) => [c, cells[ci] ?? ''])) }));
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw bad(422, 'validation', 'File JSON không hợp lệ.');
      }
      const list = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown })?.items;
      if (!Array.isArray(list) || list.some((x) => typeof x !== 'object' || !x)) throw bad(422, 'validation', 'File JSON phải là danh sách đối tượng.');
      columns = [...new Set(list.flatMap((x) => Object.keys(x as object)))];
      items = list.map((x, i) => ({ row: i + 1, values: x as Record<string, unknown> }));
    }
    if (items.length > MAX_IMPORT_ROWS) throw bad(413, 'too_large', `File có ${items.length} dòng, vượt giới hạn ${MAX_IMPORT_ROWS}.`);
    const missing = CSV_HEADER.filter((h) => !columns.includes(h));
    if (missing.length) throw bad(422, 'validation', `Thiếu cột: ${missing.join(', ')}.`);
    return { items, ignored: columns.filter((c) => !(CSV_HEADER as readonly string[]).includes(c)) };
  }

  private mac(content: string, exp: number) {
    const hash = createHash('sha256').update(content).digest('hex');
    return createHmac('sha256', config.adminApiToken).update(`questions|cau_hoi|${hash}|${exp}`).digest('base64url');
  }

  private signPreview(content: string) {
    const exp = Date.now() + PREVIEW_TTL_MS;
    return `${exp}.${this.mac(content, exp)}`;
  }

  private verifyPreview(content: string, token: string | undefined) {
    const [expRaw, sig] = String(token ?? '').split('.');
    const exp = Number(expRaw);
    const want = Number.isFinite(exp) ? this.mac(content, exp) : '';
    const okSig = !!sig && sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
    if (!okSig || exp < Date.now()) throw bad(422, 'preview_required', 'Phải chạy thử file này trước (token chạy thử thiếu, hết hạn hoặc không khớp nội dung).');
  }
}
