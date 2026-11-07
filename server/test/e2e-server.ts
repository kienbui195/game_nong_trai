// Server cho bộ e2e Playwright (web/e2e). KHÔNG dùng ở production: chỉ nằm trong test/, không vào dist.
// Khác server thật đúng hai điểm: database riêng `nongtrai_e2e`, và đồng hồ tua được qua /__e2e/*.
import './e2e-env';
import { createApp } from '../src/main';

const PORT = Number(process.env.E2E_API_PORT ?? 45330);
let offset = 0; // ms cộng thêm vào giờ thật

async function main() {
  const { app, pool } = await createApp({ clock: () => Date.now() + offset });
  const http = app.getHttpAdapter().getInstance();
  // Tua giờ server: mọi tính bù, hạn câu hỏi, serverNow gửi xuống giao diện đều đi theo.
  http.post('/__e2e/clock', (req: { query: Record<string, string> }, res: { json: (b: unknown) => void }) => {
    if (req.query.reset !== undefined) offset = 0;
    if (req.query.advance) offset += Number(req.query.advance);
    res.json({ offset, now: Date.now() + offset });
  });
  // Xoá người chơi + nông trại, đưa đồng hồ về giờ thật. Câu hỏi giữ nguyên (nạp một lần ở global setup).
  http.post('/__e2e/reset', async (req: { query: Record<string, string> }, res: { json: (b: unknown) => void }) => {
    await pool.query('DELETE FROM farms');
    await pool.query('DELETE FROM users');
    if (req.query.questions !== undefined) await pool.query('DELETE FROM questions');
    offset = 0;
    res.json({ ok: true });
  });
  // Dựng điều kiện trước cho một người chơi (xu, đồ trong kho) — thay cho việc chơi hàng giờ để có đủ.
  http.post('/__e2e/grant', async (req: { query: Record<string, string> }, res: { status: (n: number) => { json: (b: unknown) => void }; json: (b: unknown) => void }) => {
    const [rows] = (await pool.query('SELECT f.user_id, f.state FROM farms f JOIN users u ON u.id = f.user_id WHERE u.username = ?', [req.query.username])) as unknown as [{ user_id: number; state: string }[]];
    if (!rows[0]) return res.status(404).json({ error: 'không có người chơi / chưa mở nông trại' });
    const st = JSON.parse(String(rows[0].state));
    if (req.query.coins) st.coins = Number(req.query.coins);
    if (req.query.item) {
      const it = (st.inventory[req.query.item] ??= { n: 0, hq: 0 });
      it.n += Number(req.query.n ?? 1);
    }
    await pool.query('UPDATE farms SET state = ? WHERE user_id = ?', [JSON.stringify(st), rows[0].user_id]);
    res.json({ coins: st.coins, inventory: st.inventory });
  });
  await app.listen(PORT, '127.0.0.1');
  console.log(`nongtrai e2e server http://127.0.0.1:${PORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
