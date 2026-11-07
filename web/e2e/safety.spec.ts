// US-12 an toàn dữ liệu — phần qua giao diện (AC-12.1), và tài khoản bị xoá khi máy còn phiên
import { API, ADMIN_TOKEN, coins, expect, openTile, register, test } from './helpers';

test('AC-12.1 mất phản hồi lần đầu (server đã làm): gửi lại cùng mã, chỉ mua một lần', async ({ page, errors }) => {
  await register(page);
  await openTile(page, 9, 2);
  await page.getByTestId('tab-buy').click();
  const xu = await coins(page);
  let first = true;
  const ids: string[] = [];
  await page.route('**/api/farm/actions', async (route) => {
    ids.push(JSON.parse(route.request().postData()!).id);
    if (first) {
      first = false;
      await route.fetch(); // server nhận và làm thật
      await route.abort('connectionreset'); // nhưng máy không nhận được trả lời
    } else await route.continue();
  });
  await page.locator('[data-testid="buy-row-seed:rau_cai"] [data-testid=buy]').click();
  await expect.poll(() => ids.length).toBe(2);
  expect(ids[1]).toBe(ids[0]); // gửi lại đúng mã cũ
  await expect.poll(() => coins(page)).toBe(xu - 10);
  await expect(page.locator('[data-testid="buy-row-seed:rau_cai"]')).toContainText('đang có 1');
  errors.splice(0, errors.length, ...errors.filter((e) => !/ERR_CONNECTION_RESET/.test(e)));
});

test('Tài khoản bị quản trị xoá khi máy còn phiên: mở lại thì về màn đăng nhập', async ({ page }) => {
  const u = await register(page);
  const list = await (await fetch(`${API}/admin-api/players?q=${u.username}`, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } })).json();
  const id = (list.items ?? list.rows ?? list.data ?? list)[0].id;
  const del = await fetch(`${API}/admin-api/players/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
  expect(del.status).toBe(200);
  await page.reload();
  await expect(page.getByTestId('register')).toBeVisible();
  await expect(page.getByTestId('hud-coins')).toHaveCount(0);
});
