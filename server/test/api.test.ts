// Test tích hợp: app NestJS thật + MySQL thật (database nongtrai_test). Đồng hồ server giả lập được.
import './env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { createApp } from '../src/main';

const H = 3_600_000;
let now = Date.UTC(2026, 10, 1, 0, 0, 0);
let app: INestApplication;
let pool: Pool;
let url = '';
const ADMIN = { authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` };

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(url + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
const register = async (name = 'Nam', password = 'matkhau1') => {
  const r = await call('POST', '/api/auth/register', { displayName: name, password });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token as string, username: r.body.user.username as string, auth: { authorization: `Bearer ${r.body.token}` } };
};
const doAct = (auth: Record<string, string>, action: unknown, id = randomUUID()) => call('POST', '/api/farm/actions', { id, action }, auth);

const csvOf = (rows: string[][]) => '﻿' + [['do_kho', 'cau_hoi', 'dap_an_a', 'dap_an_b', 'dap_an_c', 'dap_an_d', 'dap_an_dung'], ...rows].map((r) => r.join(',')).join('\r\n');
const sampleRows = (level: number, n: number, prefix = 'Câu') => Array.from({ length: n }, (_, i) => [String(level), `${prefix} ${level}-${i}?`, `Đúng ${i}`, `Sai ${i}a`, `Sai ${i}b`, `Sai ${i}c`, 'A']);
const importCsv = async (content: string) => {
  const dry = await call('POST', '/admin-api/questions/import?dryRun=true', { format: 'csv', content }, ADMIN);
  assert.equal(dry.status, 201, JSON.stringify(dry.body));
  const real = await call('POST', '/admin-api/questions/import?dryRun=false', { format: 'csv', content, previewToken: dry.body.previewToken }, ADMIN);
  return { dry: dry.body, real: real.body, status: real.status };
};

before(async () => {
  const created = await createApp({ clock: () => now });
  app = created.app;
  pool = created.pool;
  await app.listen(0, '127.0.0.1');
  url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});
after(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  // mỗi test tự dọn dữ liệu (Luật cứng 11)
  await pool.query('DELETE FROM farms');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM questions');
  now = Date.UTC(2026, 10, 1, 0, 0, 0);
});

describe('US-01 tài khoản', () => {
  test('AC-01.1 đăng ký tạo nông trại mới 500 xu, 6 ô, thể lực 100, Xuân ngày 1', async () => {
    const u = await register();
    assert.match(u.username, /^nam/);
    const r = await call('GET', '/api/farm', undefined, u.auth);
    assert.equal(r.status, 200);
    const v = r.body.view;
    assert.equal(v.coins, 500);
    assert.equal(v.plots.length, 6);
    assert.equal(v.stamina, 100);
    assert.equal(v.seasonLabel, 'Xuân');
    assert.equal(v.dayInSeason, 1);
  });

  test('AC-01.2 + AC-01.3 mở lại sau 3 giờ 10 phút thấy rau chín; máy khác đăng nhập thấy đúng nông trại', async () => {
    const u = await register();
    await call('GET', '/api/farm', undefined, u.auth);
    assert.equal((await doAct(u.auth, { type: 'buy', itemId: 'seed:rau_cai', n: 1 })).status, 201);
    assert.equal((await doAct(u.auth, { type: 'plant', plotId: 0, cropId: 'rau_cai' })).status, 201);
    assert.equal((await doAct(u.auth, { type: 'water', plotId: 0 })).status, 201);
    now += 3 * H + 10 * 60_000;
    const login = await call('POST', '/api/auth/login', { username: u.username, password: 'matkhau1' });
    assert.equal(login.status, 201);
    const v = (await call('GET', '/api/farm', undefined, { authorization: `Bearer ${login.body.token}` })).body.view;
    assert.equal(v.coins, 490);
    assert.equal(v.plots[0].crop.stage, 'ripe');
  });

  test('AC-01.4 sai mật khẩu và sai tên cùng một thông báo', async () => {
    const u = await register();
    const a = await call('POST', '/api/auth/login', { username: u.username, password: 'sai-mat-khau' });
    const b = await call('POST', '/api/auth/login', { username: 'khongtontai', password: 'matkhau1' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, 'Sai tên đăng nhập hoặc mật khẩu.');
    assert.equal(b.body.message, a.body.message);
  });

  test('AC-01.5 phiên sai hoặc hết hạn thì 401', async () => {
    assert.equal((await call('GET', '/api/farm', undefined, { authorization: 'Bearer abc' })).status, 401);
    assert.equal((await call('GET', '/api/farm')).status, 401);
  });

  test('AC-01.6 biên mật khẩu 5/6 ký tự, tên 24/25 ký tự', async () => {
    assert.equal((await call('POST', '/api/auth/register', { displayName: 'An', password: '12345' })).status, 400);
    assert.equal((await call('POST', '/api/auth/register', { displayName: 'An', password: '123456' })).status, 201);
    assert.equal((await call('POST', '/api/auth/register', { displayName: 'x'.repeat(24), password: '123456' })).status, 201);
    assert.equal((await call('POST', '/api/auth/register', { displayName: 'x'.repeat(25), password: '123456' })).status, 400);
  });
});

describe('Thao tác qua server', () => {
  test('AC-03.3 thiếu thể lực trả 409 kèm lý do, không đổi gì', async () => {
    const u = await register();
    await doAct(u.auth, { type: 'buy', itemId: 'seed:rau_cai', n: 6 });
    let last;
    for (let i = 0; i < 6; i++) await doAct(u.auth, { type: 'plant', plotId: i, cropId: 'rau_cai' });
    // 6 ô × 2 = 12; thu/dọn không được nên tốn thể lực bằng tưới liên tục ô 0..5 cho tới cạn
    for (let i = 0; i < 88; i++) last = await doAct(u.auth, { type: 'water', plotId: i % 6 });
    assert.equal(last!.status, 201);
    const r = await doAct(u.auth, { type: 'water', plotId: 0 });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'no_stamina');
    assert.equal(r.body.view.stamina, 0);
  });

  test('AC-12.1 cùng mã thao tác gửi hai lần chỉ mua một lần', async () => {
    const u = await register();
    const id = randomUUID();
    const a = await doAct(u.auth, { type: 'buy', itemId: 'seed:rau_cai', n: 1 }, id);
    const b = await doAct(u.auth, { type: 'buy', itemId: 'seed:rau_cai', n: 1 }, id);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(b.body.replay, true);
    assert.equal(b.body.view.coins, 490);
    assert.equal(b.body.view.inventory['seed:rau_cai'].n, 1);
  });

  test('AC-12.2 hai máy cùng thu một ô: đúng một lần', async () => {
    const u = await register();
    await doAct(u.auth, { type: 'buy', itemId: 'seed:rau_cai', n: 1 });
    await doAct(u.auth, { type: 'plant', plotId: 0, cropId: 'rau_cai' });
    await doAct(u.auth, { type: 'water', plotId: 0 });
    now += 4 * H;
    const [a, b] = await Promise.all([doAct(u.auth, { type: 'harvest', plotId: 0 }), doAct(u.auth, { type: 'harvest', plotId: 0 })]);
    const codes = [a.status, b.status].sort();
    assert.deepEqual(codes, [201, 409]);
    const loser = a.status === 409 ? a : b;
    assert.equal(loser.body.error.code, 'empty');
    const v = (await call('GET', '/api/farm', undefined, u.auth)).body.view;
    const st = v.inventory['crop:rau_cai'];
    assert.equal(st.n + st.hq, 1);
  });

  test('thao tác lạ hoặc thiếu mã bị từ chối 400', async () => {
    const u = await register();
    assert.equal((await call('POST', '/api/farm/actions', { action: { type: 'buy' } }, u.auth)).status, 400);
    assert.equal((await doAct(u.auth, { type: 'hackCoins' })).status, 400);
  });
});

describe('US-09 việc làm thêm qua server', () => {
  test('AC-09.1 + AC-09.8 nhận việc, 10/10 có thưởng; dữ liệu trả về không có đáp án; câu không trùng', async () => {
    await importCsv(csvOf([...sampleRows(1, 12), ...sampleRows(2, 12), ...sampleRows(3, 12)]));
    const u = await register();
    let v = (await call('GET', '/api/farm', undefined, u.auth)).body.view;
    assert.equal(v.job.offers.length, 3);
    const offer = v.job.offers[0];
    let r = await doAct(u.auth, { type: 'acceptJob', offerId: offer.id });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.doesNotMatch(JSON.stringify(r.body), /"correct"/);
    const texts = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const q = r.body.view.job.active.question;
      texts.add(q.text);
      const choice = q.options.findIndex((o: string) => o.startsWith('Đúng'));
      r = await doAct(u.auth, { type: 'answer', idx: i, choice });
      assert.equal(r.status, 201);
    }
    assert.equal(texts.size, 10);
    v = r.body.view;
    assert.equal(v.job.last.ok, true);
    assert.equal(v.coins, 500 - offer.fee + offer.reward);
    assert.equal(v.stamina, 100);
  });

  test('AC-09.7 ngân hàng rỗng thì không có việc; nhập đủ câu thì có việc ngay', async () => {
    const u = await register();
    assert.equal((await call('GET', '/api/farm', undefined, u.auth)).body.view.job.offers.length, 0);
    await importCsv(csvOf(sampleRows(1, 10)));
    const v = (await call('GET', '/api/farm', undefined, u.auth)).body.view;
    assert.equal(v.job.offers.length, 3);
    assert.ok(v.job.offers.every((o: { level: number }) => o.level === 1));
  });
});

describe('US-10 /admin-api', () => {
  test('AC-10.4 thiếu token, sai token, đi qua proxy đều 401', async () => {
    assert.equal((await call('GET', '/admin-api/meta')).status, 401);
    assert.equal((await call('GET', '/admin-api/meta', undefined, { authorization: 'Bearer nope' })).status, 401);
    assert.equal((await call('GET', '/admin-api/meta', undefined, { ...ADMIN, 'x-forwarded-for': '1.2.3.4' })).status, 401);
    assert.equal((await call('GET', '/admin-api/meta', undefined, { ...ADMIN, 'cf-connecting-ip': '1.2.3.4' })).status, 401);
  });

  test('AC-10.1 meta, health, thêm/sửa/xoá/lọc câu hỏi, người chơi chỉ xem', async () => {
    const meta = (await call('GET', '/admin-api/meta', undefined, ADMIN)).body;
    assert.equal(meta.contractVersion, 1);
    assert.equal(meta.game.key, 'nongtrai');
    assert.deepEqual(meta.resources.map((r: { key: string }) => r.key), ['questions', 'players']);
    const health = (await call('GET', '/admin-api/health', undefined, ADMIN)).body;
    assert.equal(health.status, 'ok');
    assert.equal(health.db, 'up');
    const body = { do_kho: '2', cau_hoi: 'Thủ đô của Úc?', dap_an_a: 'Sydney', dap_an_b: 'Canberra', dap_an_c: 'Perth', dap_an_d: 'Melbourne', dap_an_dung: 'B' };
    const c = await call('POST', '/admin-api/questions', body, ADMIN);
    assert.equal(c.status, 201);
    const id = c.body.id;
    assert.equal((await call('POST', '/admin-api/questions', body, ADMIN)).status, 409);
    const bad = await call('PUT', `/admin-api/questions/${id}`, { ...body, dap_an_dung: 'E' }, ADMIN);
    assert.equal(bad.status, 422);
    assert.equal(bad.body.error.fields[0].name, 'dap_an_dung');
    assert.equal((await call('PUT', `/admin-api/questions/${id}`, { ...body, do_kho: '3' }, ADMIN)).body.do_kho, '3');
    const list = (await call('GET', '/admin-api/questions?page=1&pageSize=10&sort=id:asc&filter[do_kho]=3&q=Úc', undefined, ADMIN)).body;
    assert.equal(list.total, 1);
    assert.equal((await call('GET', '/admin-api/questions?filter[do_kho]=1', undefined, ADMIN)).body.total, 0);
    await register('Bình');
    const players = (await call('GET', '/admin-api/players', undefined, ADMIN)).body;
    assert.equal(players.total, 1);
    assert.equal(players.items[0].displayName, 'Bình');
    assert.ok(!('password_hash' in players.items[0]));
    assert.equal((await call('DELETE', `/admin-api/questions/${id}`, undefined, ADMIN)).status, 200);
    assert.equal((await call('GET', '/admin-api/rooms', undefined, ADMIN)).status, 404);
  });

  test('AC-10.2 nhập CSV 22 câu: chạy thử chưa ghi, xác nhận thì ghi; xuất rồi nhập lại thì giữ nguyên; ghi thật cần token chạy thử', async () => {
    const content = csvOf([...sampleRows(1, 7), ...sampleRows(2, 8), ...sampleRows(3, 7)]);
    const dry = await call('POST', '/admin-api/questions/import?dryRun=true', { format: 'csv', content }, ADMIN);
    assert.equal(dry.body.willCreate, 22);
    assert.equal((await call('GET', '/admin-api/questions', undefined, ADMIN)).body.total, 0);
    const noToken = await call('POST', '/admin-api/questions/import?dryRun=false', { format: 'csv', content }, ADMIN);
    assert.equal(noToken.status, 422);
    assert.equal(noToken.body.error.code, 'preview_required');
    const real = await call('POST', '/admin-api/questions/import?dryRun=false', { format: 'csv', content, previewToken: dry.body.previewToken }, ADMIN);
    assert.equal(real.body.willCreate, 22);
    assert.equal((await call('GET', '/admin-api/questions', undefined, ADMIN)).body.total, 22);
    const exp = (await call('GET', '/admin-api/questions/export?format=csv', undefined, ADMIN)).body;
    assert.equal(exp.count, 22);
    assert.match(exp.content, /^﻿do_kho,cau_hoi,dap_an_a,dap_an_b,dap_an_c,dap_an_d,dap_an_dung\r\n/);
    const again = await importCsv(exp.content);
    assert.equal(again.dry.unchanged, 22);
    assert.equal(again.real.willCreate + again.real.willUpdate, 0);
  });

  test('AC-10.2 nhận file Căn Góc Toạ Độ (mẫu của họ, có dấu ngoặc kép, chấm phẩy)', async () => {
    const theirs = '﻿do_kho;cau_hoi;dap_an_a;dap_an_b;dap_an_c;dap_an_d;dap_an_dung\r\n1;Thủ đô của Việt Nam là thành phố nào?;Hà Nội;TP. Hồ Chí Minh;Đà Nẵng;Huế;A\r\n2;"Câu có dấu ""ngoặc"" ; và chấm phẩy?";Canberra;Sydney;Melbourne;Perth;A\r\n';
    const r = await importCsv(theirs);
    assert.equal(r.real.willCreate, 2);
  });

  test('AC-10.3 dòng sai bị loại kèm số dòng và lý do, dòng đúng vẫn ghi', async () => {
    const content = csvOf([
      ['1', 'Câu đúng 1?', 'a', 'b', 'c', 'd', 'A'],
      ['2', 'Câu đúng 2?', 'a', 'b', 'c', 'd', 'D'],
      ['4', 'Độ khó sai?', 'a', 'b', 'c', 'd', 'A'],
      ['1', 'Đáp án đúng sai?', 'a', 'b', 'c', 'd', 'E'],
      ['1', 'Hai đáp án giống?', 'a', 'a', 'c', 'd', 'A'],
    ]);
    const r = await importCsv(content);
    assert.equal(r.dry.rejected.length, 3);
    assert.deepEqual(r.dry.rejected.map((x: { row: number }) => x.row), [4, 5, 6]);
    assert.deepEqual(r.dry.rejected.map((x: { field: string }) => x.field), ['do_kho', 'dap_an_dung', 'dap_an_a']);
    assert.equal(r.real.willCreate, 2);
    assert.equal((await call('GET', '/admin-api/questions', undefined, ADMIN)).body.total, 2);
  });
});
