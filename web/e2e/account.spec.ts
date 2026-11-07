// US-01 tài khoản, mở lại, mất kết nối (AC-01.1 – AC-01.6)
import { H, MIN, advance, buy, closeSheet, coins, expect, openTile, register, reopen, stamina, test } from './helpers';

test('AC-01.1 đăng ký: cấp tên đăng nhập, nông trại mới 500 xu, 6 ô, thể lực 100, Xuân ngày 1', async ({ page }) => {
  const u = await register(page, 'Nguyễn Văn Nam');
  expect(u.username).toBe('nguyenvannam');
  expect(await coins(page)).toBe(500);
  expect(await stamina(page)).toBe(100);
  await expect(page.getByTestId('hud-season')).toContainText('Xuân · ngày 1/');
  await openTile(page, 3, 6); // ô đất đầu tiên
  await expect(page.getByTestId('sheet')).toContainText('Ô đất');
});

test('AC-01.2 + AC-01.3 gieo, tưới, mở lại sau 3 giờ 10 phút thấy chín; máy khác đăng nhập thấy đúng nông trại', async ({ page, browser }) => {
  const u = await register(page);
  await buy(page, 'seed:rau_cai');
  await openTile(page, 3, 6);
  await page.getByTestId('plant-rau_cai').click();
  await page.getByTestId('water').click();
  await expect(page.getByTestId('sheet')).toContainText('Đủ nước tới'); // server đã nhận lượt tưới
  const xu = await coins(page);
  await closeSheet(page);
  await advance(3 * H + 10 * MIN);
  await reopen(page);
  await openTile(page, 3, 6);
  await expect(page.getByTestId('plot-stage')).toContainText('Đã chín');
  // máy khác: ngữ cảnh trình duyệt mới, đăng nhập bằng tên được cấp
  const other = await browser.newContext({ ...test.info().project.use });
  const p2 = await other.newPage();
  await p2.goto('/');
  await p2.getByRole('tab', { name: 'Đăng nhập' }).click();
  await p2.fill('#un', u.username);
  await p2.fill('#pw2', u.password);
  await p2.getByTestId('login').click();
  await expect(p2.getByTestId('hud-coins')).toContainText(xu.toLocaleString('vi-VN'));
  await p2.waitForTimeout(800);
  await openTile(p2, 3, 6);
  await expect(p2.getByTestId('plot-stage')).toContainText('Đã chín');
  await other.close();
});

test('AC-01.4 sai mật khẩu và tên không tồn tại: cùng một thông báo, không vào được', async ({ page }) => {
  const u = await register(page);
  await page.evaluate(() => localStorage.clear());
  for (const [un, pw] of [[u.username, 'saimatkhau'], ['khongcoai', 'matkhau1']]) {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Đăng nhập' }).click();
    await page.fill('#un', un);
    await page.fill('#pw2', pw);
    await page.getByTestId('login').click();
    await expect(page.getByText('Sai tên đăng nhập hoặc mật khẩu.')).toBeVisible();
    await expect(page.getByTestId('hud-coins')).toHaveCount(0);
  }
});

test('AC-01.5 mất kết nối: hiện dải báo, khoá nút, xu không đổi; có mạng lại thì chơi tiếp; hết phiên thì về đăng nhập', async ({ page, errors }) => {
  await register(page);
  await openTile(page, 9, 2);
  await page.getByTestId('tab-buy').click();
  const xu = await coins(page);
  await page.route('**/api/**', (r) => r.abort('internetdisconnected'));
  await page.locator('[data-testid="buy-row-seed:rau_cai"] [data-testid=buy]').click();
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  await expect(page.locator('[data-testid="buy-row-seed:rau_cai"] [data-testid=buy]')).toBeDisabled();
  expect(await coins(page)).toBe(xu);
  await page.unroute('**/api/**');
  await closeSheet(page); // dải báo nằm sau lớp phủ của hộp thoại
  await page.getByTestId('offline-banner').getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);
  expect(await coins(page)).toBe(xu); // server không ghi gì lúc mất mạng
  // hai lần gửi bị cắt mạng có chủ đích (gửi + gửi lại cùng mã) — không phải lỗi giao diện
  const cut = errors.filter((e) => /ERR_INTERNET_DISCONNECTED/.test(e));
  expect(cut).toHaveLength(2);
  errors.splice(0, errors.length, ...errors.filter((e) => !cut.includes(e)));
  // phiên hết hạn / sai: về màn đăng nhập
  await page.evaluate(() => localStorage.setItem('nongtrai_token', 'het-han'));
  await page.reload();
  await expect(page.getByTestId('login').or(page.getByTestId('register'))).toBeVisible();
  await expect(page.getByTestId('hud-coins')).toHaveCount(0);
});

test('AC-01.6 biên: mật khẩu 5 bị từ chối kèm lý do, 6 được; tên 25 bị từ chối, 24 được', async ({ page }) => {
  for (const [name, pw, okExpected, msg] of [
    ['An', '12345', false, 'Mật khẩu'],
    ['x'.repeat(25), 'matkhau1', false, 'Tên hiển thị'],
    ['x'.repeat(24), 'matkhau1', true, ''],
  ] as const) {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.fill('#dn', name);
    await page.fill('#pw1', pw);
    await page.getByTestId('register').click();
    if (okExpected) await expect(page.getByTestId('new-username')).toBeVisible();
    else {
      await expect(page.getByText(msg, { exact: false }).last()).toBeVisible();
      await expect(page.getByTestId('new-username')).toHaveCount(0);
    }
  }
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await register(page, 'An', '123456'); // 6 ký tự được
});
