// Trước mỗi lần chạy bộ e2e: xoá sạch DB e2e, nạp ngân hàng câu hỏi qua /admin-api thật (chạy thử → xác nhận).
import { API, ADMIN_TOKEN, csvQuestions } from './helpers';

export default async function globalSetup() {
  const reset = await fetch(`${API}/__e2e/reset?questions`, { method: 'POST' });
  if (!reset.ok) throw new Error(`reset e2e lỗi ${reset.status}`);
  await seedQuestions();
}

/** Nạp 30 câu (ngân hàng phải đang rỗng). Không đụng người chơi. */
export async function seedQuestions() {
  const content = csvQuestions(10, 3); // 10 câu mỗi mức × 3 mức: đủ để mỗi mức có việc
  const h = { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` };
  const dry = await fetch(`${API}/admin-api/questions/import?dryRun=true`, { method: 'POST', headers: h, body: JSON.stringify({ format: 'csv', content }) });
  const d = await dry.json();
  if (!dry.ok || d.willCreate !== 30) throw new Error(`chạy thử nhập câu hỏi sai: ${JSON.stringify(d)}`);
  const real = await fetch(`${API}/admin-api/questions/import?dryRun=false`, { method: 'POST', headers: h, body: JSON.stringify({ format: 'csv', content, previewToken: d.previewToken }) });
  if (!real.ok) throw new Error(`nhập câu hỏi lỗi ${real.status} ${await real.text()}`);
}
