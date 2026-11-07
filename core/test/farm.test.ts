// Lõi luật: thể lực, trồng trọt, tính bù, giữ thao tác (AC-01.x, 03.x, 04.x, 12.x).
import { describe, expect, test } from 'vitest';
import { act, catchUp, newFarm, staminaAt, view } from '../src/engine';
import { D, H, MIN, T0, cu, fail, fresh, give, ok, vw } from './helpers';

describe('US-01 nông trại mới', () => {
  test('AC-01.1 số liệu khởi đầu', () => {
    const f = fresh();
    expect(f.coins).toBe(500);
    expect(f.plots).toHaveLength(6);
    expect(f.plots.every((p) => p.crop === null)).toBe(true);
    expect(f.stamina).toBe(100);
    const v = vw(f, T0);
    expect(v.season).toBe('spring');
    expect(v.dayInSeason).toBe(1);
  });

  test('AC-01.2 mở lại sau 3 giờ 10 phút thì rau cải đã chín', () => {
    let f = give(fresh(), 'seed:rau_cai', 1);
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0);
    f = ok(f, { type: 'water', plotId: 0 }, T0);
    const v = vw(f, T0 + 3 * H + 10 * MIN);
    expect(v.plots[0].crop?.ripe).toBe(true);
  });
});

describe('US-03 thể lực và ngủ', () => {
  test('AC-03.1 trừ đúng bảng; mua, đi không trừ', () => {
    let f = give(fresh(), 'seed:rau_cai', 2);
    f.stamina = 50;
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0);
    f = ok(f, { type: 'water', plotId: 0 }, T0);
    f = ok(f, { type: 'harvest', plotId: 0 }, T0 + 4 * H);
    expect(f.stamina).toBe(46);
    f = ok(f, { type: 'buy', itemId: 'seed:rau_cai', n: 10 }, T0 + 4 * H);
    expect(f.stamina).toBe(46);
  });

  test('AC-03.2 ngủ 30 phút từ 20 lên 70, ngủ lâu thì dừng ở 100; xem chợ vẫn đang ngủ', () => {
    let f = fresh();
    f.stamina = 20;
    f = ok(f, { type: 'sleep' }, T0);
    expect(staminaAt(f, T0 + 30 * MIN)).toBe(70);
    f = ok(f, { type: 'buy', itemId: 'seed:rau_cai', n: 1 }, T0 + 30 * MIN); // không phải việc lao động
    expect(f.sleep).not.toBeNull();
    f = ok(f, { type: 'wake' }, T0 + 30 * MIN);
    expect(f.stamina).toBe(70);
    f.stamina = 20;
    f = ok(f, { type: 'sleep' }, T0 + H);
    expect(staminaAt(f, T0 + 3 * H)).toBe(100);
  });

  test('AC-03.2 việc lao động khi đang ngủ thì tự dậy rồi làm', () => {
    let f = give(fresh(), 'seed:rau_cai', 1);
    f.stamina = 10;
    f = ok(f, { type: 'sleep' }, T0);
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0 + 6 * MIN); // +10 khi ngủ
    expect(f.sleep).toBeNull();
    expect(f.stamina).toBe(18);
  });

  test('AC-03.3 còn 2 thì gieo được, còn 0 thì từ chối và không đổi gì', () => {
    let f = give(fresh(), 'seed:rau_cai', 2);
    f.stamina = 2;
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0);
    expect(f.stamina).toBe(0);
    const r = fail(f, { type: 'plant', plotId: 1, cropId: 'rau_cai' }, T0, 'no_stamina');
    expect(r.error!.message).toContain('2');
    expect(r.farm.plots[1].crop).toBeNull();
    expect(r.farm.inventory['seed:rau_cai'].n).toBe(1);
  });

  test('AC-03.4 đang thức thì không tự hồi', () => {
    const f = fresh();
    f.stamina = 10;
    expect(staminaAt(f, T0 + 3 * H)).toBe(10);
    expect(vw(f, T0 + 3 * H).stamina).toBe(10);
  });
});

describe('US-04 trồng trọt', () => {
  test('AC-04.1 gieo, tưới, 3 giờ, thu', () => {
    let f = give(fresh(), 'seed:rau_cai', 1);
    const s0 = f.stamina;
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0);
    f = ok(f, { type: 'water', plotId: 0 }, T0);
    fail(f, { type: 'harvest', plotId: 0 }, T0 + 2 * H, 'not_ripe');
    f = ok(f, { type: 'harvest', plotId: 0 }, T0 + 3 * H + 10 * MIN);
    const st = f.inventory['crop:rau_cai'];
    expect(st.n + st.hq).toBe(1);
    expect(f.plots[0].crop).toBeNull();
    expect(f.stamina).toBe(s0 - 4);
  });

  test('AC-04.2 tưới có hiệu lực 24 giờ; khô thì dừng lớn, sức khoẻ giảm; tưới lại lớn tiếp', () => {
    let f = give(fresh(), 'seed:khoai_tay', 1);
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'khoai_tay' }, T0);
    f = ok(f, { type: 'water', plotId: 0 }, T0);
    const at24 = cu(f, T0 + 24 * H).plots[0].crop!;
    expect(at24.growMs).toBe(24 * H - 0); // đủ 24 giờ lớn
    expect(at24.ripe).toBe(true);
    // ô khác: khô từ giờ 24, kiểm ở giờ 26
    let g = give(fresh(), 'seed:su_hao', 1);
    g = ok(g, { type: 'plant', plotId: 0, cropId: 'su_hao' }, T0);
    g = ok(g, { type: 'water', plotId: 0 }, T0);
    const c26 = cu(g, T0 + 26 * H).plots[0].crop!;
    expect(c26.growMs).toBe(24 * H);
    const c24 = cu(g, T0 + 24 * H).plots[0].crop!;
    expect(c26.health).toBeLessThan(c24.health);
    g = ok(g, { type: 'water', plotId: 0 }, T0 + 26 * H);
    // 36 giờ lớn: 24 giờ đầu + 12 giờ sau khi tưới lại lúc giờ 26 → chín ở giờ 38 (dời đúng 2 giờ khô)
    const c37 = cu(g, T0 + 37 * H).plots[0].crop!;
    expect(c37.growMs).toBe(35 * H);
    expect(c37.ripe).toBe(false);
    expect(cu(g, T0 + 38 * H).plots[0].crop!.ripe).toBe(true);
  });

  test('AC-04.3 phun sớm lớn tiếp ngay; phun muộn 5 giờ thì hồi phục 5 giờ', () => {
    let f = give(give(fresh(), 'seed:khoai_tay', 2), 'med:pest', 2);
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'khoai_tay' }, T0);
    f = ok(f, { type: 'plant', plotId: 1, cropId: 'khoai_tay' }, T0);
    f = ok(f, { type: 'water', plotId: 0 }, T0);
    f = ok(f, { type: 'water', plotId: 1 }, T0);
    f = cu(f, T0 + 2 * H);
    f.plots[0].crop!.pestSince = T0 + 2 * H;
    f.plots[1].crop!.pestSince = T0 + 2 * H;
    f = ok(f, { type: 'spray', plotId: 0 }, T0 + 3 * H + 50 * MIN);
    f = ok(f, { type: 'spray', plotId: 1 }, T0 + 7 * H);
    expect(f.plots[0].crop!.recoverMs).toBe(0);
    expect(f.plots[1].crop!.recoverMs).toBe(5 * H);
    const g1 = f.plots[1].crop!.growMs;
    const later = cu(f, T0 + 12 * H);
    expect(later.plots[1].crop!.growMs).toBe(g1); // 5 giờ hồi phục không lớn
    const after = cu(f, T0 + 13 * H);
    expect(after.plots[1].crop!.growMs).toBe(g1 + H);
  });

  test('AC-04.3 biên 2 giờ: 1 giờ 50 không hồi phục, đúng 2 giờ thì hồi phục 2 giờ, 30 giờ thì tối đa 24 giờ', () => {
    for (const [dur, rec] of [
      [110 * MIN, 0],
      [2 * H, 2 * H],
      [30 * H, 24 * H],
    ]) {
      let f = give(give(fresh(), 'seed:khoai_tay', 1), 'med:pest', 1);
      f = ok(f, { type: 'plant', plotId: 0, cropId: 'khoai_tay' }, T0);
      f.plots[0].crop!.pestSince = T0;
      f = ok(f, { type: 'spray', plotId: 0 }, T0 + dur);
      expect(f.plots[0].crop!.recoverMs).toBe(rec);
    }
  });

  test('AC-04.4 cây ăn quả: lớn trong mùa, ra quả theo chu kỳ, ngoài mùa ngủ, chặt được', () => {
    let f = give(fresh(), 'seed:dau_tay', 1);
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'dau_tay' }, T0);
    // tưới mỗi ngày
    for (let d = 0; d < 7; d++) f = ok(f, { type: 'water', plotId: 0 }, T0 + d * D);
    let v = cu(f, T0 + 4 * D);
    expect(v.plots[0].crop!.mature).toBe(true);
    v = cu(f, T0 + 5 * D);
    expect(v.plots[0].crop!.fruitReady).toBe(true);
    f = ok(f, { type: 'harvest', plotId: 0 }, T0 + 5 * D);
    const st = f.inventory['crop:dau_tay'];
    expect(st.n + st.hq).toBe(3);
    expect(f.plots[0].crop).not.toBeNull();
    // sang mùa Hạ: không tưới, không mất sức khoẻ, không ra quả
    const hStart = cu(f, T0 + 7 * D).plots[0].crop!;
    const hLater = cu(f, T0 + 12 * D).plots[0].crop!;
    expect(hLater.health).toBe(hStart.health);
    expect(hLater.fruitReady).toBe(hStart.fruitReady);
    expect(hLater.cycleMs).toBe(hStart.cycleMs);
    f = ok(f, { type: 'clear', plotId: 0 }, T0 + 12 * D);
    expect(f.plots[0].crop).toBeNull();
  });

  test('AC-04.5 sang mùa: cây ngắn/dài ngày chưa thu thì héo, cây ăn quả còn; dọn tốn 3', () => {
    let f = give(give(fresh(), 'seed:su_hao', 1), 'seed:dao', 1);
    f.coins = 99999;
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'su_hao' }, T0 + 5 * D);
    f = ok(f, { type: 'water', plotId: 0 }, T0 + 5 * D);
    f = ok(f, { type: 'water', plotId: 0 }, T0 + 6 * D);
    f = ok(f, { type: 'plant', plotId: 1, cropId: 'dao' }, T0 + 5 * D);
    const before = cu(f, T0 + 7 * D - MIN).plots[0].crop!;
    expect(before.ripe).toBe(true);
    f = cu(f, T0 + 7 * D + 10 * MIN);
    expect(f.plots[0].crop!.withered).toBe(true);
    expect(f.plots[1].crop!.withered).toBe(false);
    fail(f, { type: 'harvest', plotId: 0 }, T0 + 7 * D + 10 * MIN, 'withered');
    f.stamina = 50;
    f = ok(f, { type: 'clear', plotId: 0 }, T0 + 7 * D + 10 * MIN);
    expect(f.stamina).toBe(47);
    expect(f.plots[0].crop).toBeNull();
  });

  test('AC-04.6 hạt trái mùa bị từ chối; gieo muộn cần xác nhận', () => {
    let f = give(give(fresh(), 'seed:su_hao', 1), 'seed:dua_hau', 1);
    const t = T0 + 7 * D - 20 * H; // còn 20 giờ hết Xuân
    fail(f, { type: 'plant', plotId: 0, cropId: 'dua_hau' }, t, 'wrong_season');
    fail(f, { type: 'plant', plotId: 0, cropId: 'su_hao' }, t, 'late');
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'su_hao', confirmLate: true }, t);
    expect(f.plots[0].crop?.cropId).toBe('su_hao');
  });

  test('AC-04.7 bón một lần mỗi vụ, phân tốt lớn nhanh 30%; không có hạt thì báo thiếu', () => {
    let f = give(give(fresh(), 'seed:khoai_tay', 1), 'fert:good', 2);
    f = ok(f, { type: 'plant', plotId: 0, cropId: 'khoai_tay' }, T0);
    f = ok(f, { type: 'water', plotId: 0 }, T0);
    f = ok(f, { type: 'fertilize', plotId: 0, fertilizer: 'good' }, T0);
    fail(f, { type: 'fertilize', plotId: 0, fertilizer: 'good' }, T0, 'already_fertilized');
    expect(f.inventory['fert:good'].n).toBe(1);
    const c = cu(f, T0 + 10 * H).plots[0].crop!;
    expect(c.growMs).toBe(13 * H);
    fail(f, { type: 'plant', plotId: 1, cropId: 'xa_lach' }, T0, 'no_item');
  });
});

describe('US-12 an toàn dữ liệu', () => {
  test('AC-12.1 cùng mã thao tác gửi hai lần thì chỉ làm một lần', () => {
    let f = fresh();
    const r1 = act(f, { type: 'buy', itemId: 'seed:rau_cai', n: 1 }, T0, undefined, 'abc');
    const r2 = act(r1.farm, { type: 'buy', itemId: 'seed:rau_cai', n: 1 }, T0 + 1000, undefined, 'abc');
    expect(r2.replay).toBe(true);
    expect(r2.farm.coins).toBe(490);
    expect(r2.farm.inventory['seed:rau_cai'].n).toBe(1);
    // quá 10 phút thì mã cũ bị quên
    const r3 = act(r2.farm, { type: 'buy', itemId: 'seed:rau_cai', n: 1 }, T0 + 11 * MIN, undefined, 'abc');
    expect(r3.replay).toBeFalsy();
  });

  test('AC-12.3 tính bù một lần hay nhiều lần ra cùng kết quả', () => {
    let f = give(give(fresh(7), 'seed:khoai_tay', 6), 'seed:dau_tay', 1);
    f.coins = 99999;
    for (let i = 0; i < 6; i++) f = ok(f, { type: 'plant', plotId: i, cropId: i === 5 ? 'dau_tay' : 'khoai_tay' }, T0, {});
    f = ok(f, { type: 'expand', what: 'coop' }, T0, {});
    f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: f.buildings[0].id }, T0, {});
    const once = catchUp(f, T0 + 7 * D);
    let many = f;
    for (let t = T0 + 37 * MIN; t < T0 + 7 * D; t += 13 * H + 7 * MIN) many = catchUp(many, t);
    many = catchUp(many, T0 + 7 * D);
    expect(many).toEqual(once);
  });

  test('BR3 mã lạ trong thao tác (tên thuộc tính JS, không phải chuỗi) bị từ chối, nông trại không hỏng', () => {
    let f = give(fresh(), 'fert:good', 1);
    f.coins = 99999;
    f = ok(f, { type: 'expand', what: 'pond' }, T0);
    f = ok(f, { type: 'expand', what: 'coop' }, T0);
    f = give(ok(give(f, 'seed:rau_cai', 1), { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0), 'seed:rau_cai', 1);
    const pond = f.ponds[0].buildingId;
    const coop = f.buildings.find((b) => b.type === 'coop')!.id;
    const bad = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
    for (const k of bad) {
      fail(f, { type: 'buyFish', species: k, n: 1, buildingId: pond } as never, T0, 'bad_input');
      fail(f, { type: 'buyAnimal', species: k, buildingId: coop } as never, T0, 'bad_input');
      fail(f, { type: 'plant', plotId: 1, cropId: k } as never, T0, 'bad_input');
      fail(f, { type: 'fertilize', plotId: 0, fertilizer: k } as never, T0, 'bad_input');
      fail(f, { type: 'buy', itemId: k, n: 1 } as never, T0, 'bad_input');
      fail(f, { type: 'buy', itemId: `seed:${k}`, n: 1 } as never, T0, 'bad_input');
      fail(f, { type: 'sell', itemId: k, n: 1, hq: false, expected: 1 } as never, T0, 'bad_input');
      fail(f, { type: 'expand', what: k } as never, T0, 'bad_input');
    }
    for (const v of [1, null, {}, ['seed:rau_cai']]) {
      fail(f, { type: 'buy', itemId: v, n: 1 } as never, T0, 'bad_input');
      fail(f, { type: 'buyFish', species: v, n: 1, buildingId: pond } as never, T0, 'bad_input');
    }
    expect(() => vw(f, T0 + H)).not.toThrow();
  });

  test('tính bù 60 ngày với nhiều thứ vẫn nhanh (< 200 ms)', () => {
    let f = newFarm(T0, 1);
    f.coins = 1e9;
    for (let i = 0; i < 8; i++) f = ok(f, { type: 'expand', what: 'plots' }, T0);
    for (const w of ['coop', 'coop', 'barn', 'barn', 'pond', 'pond'] as const) f = ok(f, { type: 'expand', what: w }, T0);
    const t = performance.now();
    catchUp(f, T0 + 60 * D);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
