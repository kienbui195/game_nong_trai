// Lõi luật: chăn nuôi, cá, chợ, mở rộng, việc làm thêm, chất lượng (AC-04.8, 05.x, 06.x, 07.x, 08.x, 09.x).
import { describe, expect, test } from 'vitest';
import { act, harvestQualityChance, marketPrice, newFarm, view } from '../src/engine';
import { D, H, MIN, T0, allLevels, cu, fail, fresh, give, ok, questions } from './helpers';
import type { Farm } from '../src/types';

const rich = () => {
  const f = fresh();
  f.coins = 100_000;
  return f;
};
const withCoop = (f: Farm = rich()) => ok(f, { type: 'expand', what: 'coop' }, T0);

describe('US-05 chăn nuôi', () => {
  test('AC-05.1 mua gà, cho ăn: 24 giờ trưởng thành, 24 giờ nữa có trứng, thu vào kho', () => {
    let f = give(withCoop(), 'feed:poultry', 5);
    const c0 = f.coins;
    f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: f.buildings[0].id }, T0);
    expect(f.coins).toBe(c0 - 200);
    const id = f.animals[0].id;
    f = ok(f, { type: 'feed', animalId: id }, T0);
    f = ok(f, { type: 'feed', animalId: id }, T0 + D);
    expect(cu(f, T0 + D).animals[0].mature).toBe(true);
    expect(cu(f, T0 + 2 * D - 10 * MIN).animals[0].product).toBeNull();
    expect(cu(f, T0 + 2 * D).animals[0].product).not.toBeNull();
    f = ok(f, { type: 'collect', animalId: id }, T0 + 2 * D);
    const st = f.inventory['prod:trung_ga'];
    expect(st.n + st.hq).toBe(1);
  });

  test('AC-05.2 bán gà non được 100, gà trưởng thành được 220', () => {
    let f = give(withCoop(), 'feed:poultry', 5);
    const b = f.buildings[0].id;
    f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: b }, T0);
    f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: b }, T0);
    const [young, old] = f.animals.map((x) => x.id);
    f = ok(f, { type: 'feed', animalId: old }, T0);
    let c = f.coins;
    f = ok(f, { type: 'sellAnimal', animalId: young }, T0 + 10 * H);
    expect(f.coins - c).toBe(100);
    c = f.coins;
    f = ok(f, { type: 'sellAnimal', animalId: old }, T0 + 24 * H);
    expect(f.coins - c).toBe(220);
    expect(f.animals).toHaveLength(0);
  });

  test('AC-05.3 bỏ đói: dừng lớn, không ra sữa, ốm dưới 30; chỉ cho ăn không khỏi; thuốc thì về 50; không chết', () => {
    let f = rich();
    f = ok(f, { type: 'expand', what: 'barn' }, T0);
    f = give(give(f, 'feed:livestock', 10), 'med:livestock', 1);
    f = ok(f, { type: 'buyAnimal', species: 'bo', buildingId: f.buildings[0].id }, T0);
    const id = f.animals[0].id;
    f = ok(f, { type: 'feed', animalId: id }, T0);
    const hungry = cu(f, T0 + 36 * H).animals[0];
    expect(hungry.ageMs).toBe(24 * H);
    expect(hungry.sick).toBe(false);
    // sức khoẻ: 80 + 2×24 = 100 (trần) rồi −3/giờ khi đói: chạm 30 sau khoảng 23,3 giờ đói
    let t = T0 + 24 * H;
    let a = cu(f, t).animals[0];
    while (!a.sick) {
      expect(a.health).toBeGreaterThanOrEqual(30);
      t += 10 * MIN;
      a = cu(f, t).animals[0];
    }
    expect(a.health).toBeLessThan(30);
    f = ok(f, { type: 'feed', animalId: id }, t);
    const still = cu(f, t + 6 * H).animals[0];
    expect(still.sick).toBe(true);
    expect(still.health).toBeCloseTo(a.health, 5);
    f = ok(f, { type: 'medicate', animalId: id }, t + 6 * H);
    expect(f.animals[0].sick).toBe(false);
    expect(f.animals[0].health).toBe(50);
    fail(f, { type: 'medicate', animalId: id }, t + 6 * H, 'not_sick');
    expect(cu(f, T0 + 30 * D).animals).toHaveLength(1); // không chết
  });

  test('AC-05.4 trứng không thu thì chỉ giữ 1 lượt', () => {
    let f = give(withCoop(), 'feed:poultry', 10);
    f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: f.buildings[0].id }, T0);
    const id = f.animals[0].id;
    for (let d = 0; d < 5; d++) f = ok(f, { type: 'feed', animalId: id }, T0 + d * D);
    expect(cu(f, T0 + 5 * D).animals[0].product?.qty).toBe(1);
  });

  test('AC-05.5 vuốt ve, dắt dạo mỗi ngày một lần; ngày không tương tác thì −5', () => {
    let f = rich();
    f = ok(f, { type: 'expand', what: 'barn' }, T0);
    f = ok(f, { type: 'buyAnimal', species: 'de', buildingId: f.buildings[0].id }, T0);
    const id = f.animals[0].id;
    f = ok(f, { type: 'pet', animalId: id }, T0 + H);
    f = ok(f, { type: 'walk', animalId: id }, T0 + H);
    expect(f.animals[0].affection).toBe(45);
    const s = f.stamina;
    fail(f, { type: 'pet', animalId: id }, T0 + 2 * H, 'already_today');
    expect(f.stamina).toBe(s);
    expect(cu(f, T0 + 2 * D).animals[0].affection).toBe(40); // ngày 2 không ai đụng tới
  });

  test('AC-05.6 chuồng đầy, chưa có chuồng gia súc, hết thức ăn', () => {
    let f = withCoop();
    const b = f.buildings[0].id;
    for (let i = 0; i < 5; i++) f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: b }, T0);
    const c = f.coins;
    f = ok(f, { type: 'buyAnimal', species: 'ga', buildingId: b }, T0);
    fail(f, { type: 'buyAnimal', species: 'ga', buildingId: b }, T0, 'full');
    fail(f, { type: 'buyAnimal', species: 'bo', buildingId: b }, T0, 'wrong_building');
    fail(f, { type: 'feed', animalId: f.animals[0].id }, T0, 'no_item');
    expect(f.coins).toBe(c - 200);
  });
});

describe('US-06 nuôi cá', () => {
  const withPond = () => {
    let f = ok(rich(), { type: 'expand', what: 'pond' }, T0);
    f = give(give(f, 'feed:fish', 10), 'med:fish', 1);
    return f;
  };

  test('AC-06.1 cá lớn 36 giờ, bán theo giá chợ, giá tụt theo số đã bán', () => {
    let f = withPond();
    const b = f.buildings[0].id;
    f = ok(f, { type: 'buyFish', buildingId: b, species: 'ro_phi', n: 3 }, T0);
    f = ok(f, { type: 'feedPond', buildingId: b }, T0);
    f = ok(f, { type: 'feedPond', buildingId: b }, T0 + D);
    const t = T0 + 36 * H;
    const p1 = marketPrice(cu(f, t), 'fish:ro_phi', t, false);
    const fishId = f.ponds[0].fish[0].id;
    const c = f.coins;
    f = ok(f, { type: 'sellFish', buildingId: b, fishId }, t);
    expect([p1, Math.round(p1 * 1.5)]).toContain(f.coins - c);
    expect(marketPrice(f, 'fish:ro_phi', t, false)).toBeLessThan(p1);
  });

  test('AC-06.2 ao đầy, cá chưa lớn', () => {
    let f = withPond();
    const b = f.buildings[0].id;
    f = ok(f, { type: 'buyFish', buildingId: b, species: 'ro_phi', n: 10 }, T0);
    fail(f, { type: 'buyFish', buildingId: b, species: 'ro_phi', n: 1 }, T0, 'full');
    fail(f, { type: 'sellFish', buildingId: b, fishId: f.ponds[0].fish[0].id }, T0 + 20 * H, 'not_mature');
  });

  test('AC-06.3 ao bị bỏ đói tới ốm; trò chuyện lần 2 không tăng; ăn chưa khỏi; thuốc thì khỏi', () => {
    let f = withPond();
    const b = f.buildings[0].id;
    f = ok(f, { type: 'buyFish', buildingId: b, species: 'chep', n: 2 }, T0);
    let t = T0 + 3 * D;
    expect(cu(f, t).ponds[0].sick).toBe(true);
    f = ok(f, { type: 'talkPond', buildingId: b }, t);
    fail(f, { type: 'talkPond', buildingId: b }, t, 'already_today');
    f = ok(f, { type: 'feedPond', buildingId: b }, t);
    expect(cu(f, t + H).ponds[0].sick).toBe(true);
    f = ok(f, { type: 'medicatePond', buildingId: b }, t + H);
    const age = f.ponds[0].fish[0].ageMs;
    expect(cu(f, t + 3 * H).ponds[0].fish[0].ageMs).toBeGreaterThan(age);
  });
});

describe('US-07 chợ', () => {
  test('AC-07.1 bán 10 bí ngô: mỗi cái sau thấp hơn 1%, giá hiện giảm 10%', () => {
    let f = give(fresh(), 'crop:bi_ngo', 10);
    const p = marketPrice(f, 'crop:bi_ngo', T0, false);
    const c = f.coins;
    f = ok(f, { type: 'sell', itemId: 'crop:bi_ngo', n: 10, hq: false, expected: p }, T0);
    const base = p / 1; // giá cái đầu
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += marketPrice({ ...fresh(), market: { 'crop:bi_ngo': { drop: i * 0.01, at: T0 } } }, 'crop:bi_ngo', T0, false);
    expect(f.coins - c).toBe(sum);
    expect(base).toBe(p);
    const now = marketPrice(f, 'crop:bi_ngo', T0, false);
    expect(now).toBe(marketPrice({ ...fresh(), market: { 'crop:bi_ngo': { drop: 0.1, at: T0 } } }, 'crop:bi_ngo', T0, false));
  });

  test('AC-07.2 giảm tối đa 30%, hồi 5% mỗi giờ', () => {
    let f = give(fresh(), 'prod:trung_ga', 40);
    const p = (ff: Farm, t: number) => marketPrice(ff, 'prod:trung_ga', t, false);
    f = ok(f, { type: 'sell', itemId: 'prod:trung_ga', n: 30, hq: false, expected: p(f, T0) }, T0);
    expect(f.market['prod:trung_ga'].drop).toBeCloseTo(0.3, 10);
    f = ok(f, { type: 'sell', itemId: 'prod:trung_ga', n: 1, hq: false, expected: p(f, T0) }, T0);
    expect(f.market['prod:trung_ga'].drop).toBeCloseTo(0.3, 10);
    const ref = (drop: number) => marketPrice({ ...fresh(), market: { 'prod:trung_ga': { drop, at: T0 + 2 * H } } }, 'prod:trung_ga', T0 + 2 * H, false);
    expect(p(f, T0 + 2 * H)).toBe(ref(0.2));
  });

  test('AC-07.3 hệ số 0,70–1,30; đúng mùa ×0,85, trái mùa ×1,15; mũi tên đúng chiều', () => {
    const f = fresh(123);
    for (let k = 0; k < 1000; k++) {
      const t = T0 + k * 4 * H;
      const v = view(f, t);
      const m = v.market.find((x) => x.itemId === 'crop:rau_cai')!;
      expect(m.factor).toBeGreaterThanOrEqual(0.7);
      expect(m.factor).toBeLessThanOrEqual(1.3);
      const season = v.season;
      expect(m.seasonFactor).toBe(season === 'spring' ? 0.85 : 1.15);
      expect(m.price).toBe(Math.max(1, Math.round(24 * m.factor * m.seasonFactor)));
      const diff = (m.price - m.prevPrice) / m.prevPrice;
      expect(m.trend).toBe(Math.abs(diff) < 0.03 ? 'flat' : diff > 0 ? 'up' : 'down');
    }
  });

  test('AC-07.4 có 40 xu: mua thuốc 25 được, phân tốt 40 thì thiếu 25; có đúng 40 thì mua được', () => {
    let f = fresh();
    f.coins = 40;
    f = ok(f, { type: 'buy', itemId: 'med:pest', n: 1 }, T0);
    expect(f.coins).toBe(15);
    const r = fail(f, { type: 'buy', itemId: 'fert:good', n: 1 }, T0, 'no_coins');
    expect(r.error!.message).toContain('25');
    expect(r.farm.inventory['fert:good']).toBeUndefined();
    const g = fresh();
    g.coins = 40;
    expect(ok(g, { type: 'buy', itemId: 'fert:good', n: 1 }, T0).coins).toBe(0);
  });

  test('AC-07.5 bán quá số có; giá đã đổi thì báo giá mới', () => {
    const f = give(fresh(), 'crop:xoai', 3);
    const p = marketPrice(f, 'crop:xoai', T0, false);
    fail(f, { type: 'sell', itemId: 'crop:xoai', n: 4, hq: false, expected: p }, T0, 'not_enough');
    // tìm kỳ 4 giờ đầu tiên có giá khác (giá theo seed nên tất định); không được bỏ qua nhánh "giá đã đổi"
    let t = T0;
    for (let k = 1; k <= 20 && marketPrice(f, 'crop:xoai', t, false) === p; k++) t = T0 + k * 4 * H;
    const p2 = marketPrice(f, 'crop:xoai', t, false);
    expect(p2).not.toBe(p);
    const r = fail(f, { type: 'sell', itemId: 'crop:xoai', n: 3, hq: false, expected: p }, t, 'price_changed');
    expect(r.error!.data?.price).toBe(p2);
    expect(ok(f, { type: 'sell', itemId: 'crop:xoai', n: 3, hq: false, expected: p2 }, t).inventory['crop:xoai'].n).toBe(0);
  });
});

describe('US-08 mở rộng', () => {
  test('AC-08.1 mua thêm đất: 300 → 9 ô, lần sau 600', () => {
    let f = fresh();
    f.coins = 1000;
    f = ok(f, { type: 'expand', what: 'plots' }, T0);
    expect(f.coins).toBe(700);
    expect(f.plots).toHaveLength(9);
    expect(view(f, T0).expansion.plots.price).toBe(600);
  });

  test('AC-08.2 tới 30 ô thì dừng', () => {
    let f = rich();
    for (let i = 0; i < 8; i++) f = ok(f, { type: 'expand', what: 'plots' }, T0);
    expect(f.plots).toHaveLength(30);
    fail(f, { type: 'expand', what: 'plots' }, T0, 'max');
    expect(view(f, T0).expansion.plots.price).toBeNull();
  });

  test('AC-08.3 chuồng 6 chỗ, nâng lên 12, nâng lần hai bị từ chối; ao 10 chỗ; tối đa 2 chuồng', () => {
    let f = withCoop();
    expect(f.buildings[0].capacity).toBe(6);
    f = ok(f, { type: 'upgrade', buildingId: f.buildings[0].id }, T0);
    expect(f.buildings[0].capacity).toBe(12);
    fail(f, { type: 'upgrade', buildingId: f.buildings[0].id }, T0, 'max');
    f = ok(f, { type: 'expand', what: 'pond' }, T0);
    expect(f.buildings[1].capacity).toBe(10);
    f = ok(f, { type: 'expand', what: 'coop' }, T0);
    fail(f, { type: 'expand', what: 'coop' }, T0, 'max');
  });
});

describe('US-09 việc làm thêm', () => {
  const ready = (coins = 500) => {
    const f = newFarm(T0, 9, allLevels);
    f.coins = coins;
    return f;
  };
  const ctxQ = (level: number) => ({ ...allLevels, questions: questions(level) });

  test('AC-09.1 đúng 10/10 thì nhận thưởng; thể lực không đổi; hai việc kia giữ nguyên', () => {
    let f = ready();
    f.stamina = 40;
    const offer = f.job.offers[0];
    const others = f.job.offers.slice(1).map((o) => o.id);
    expect(offer.fee).toBeGreaterThanOrEqual(5);
    f = ok(f, { type: 'acceptJob', offerId: offer.id }, T0, ctxQ(offer.level));
    expect(f.coins).toBe(500 - offer.fee);
    expect(f.job.offers.map((o) => o.id)).toEqual(others);
    for (let i = 0; i < 10; i++) f = ok(f, { type: 'answer', idx: i, choice: 0 }, T0 + i * 5000, allLevels);
    expect(f.coins).toBe(500 - offer.fee + offer.reward);
    expect(f.stamina).toBe(40);
    expect(f.job.last?.ok).toBe(true);
  });

  test('AC-09.2 sai câu 7 thì thất bại ngay, mất phí, hiện đáp án đúng', () => {
    let f = ready();
    const offer = f.job.offers[0];
    f = ok(f, { type: 'acceptJob', offerId: offer.id }, T0, ctxQ(offer.level));
    for (let i = 0; i < 6; i++) f = ok(f, { type: 'answer', idx: i, choice: 0 }, T0, allLevels);
    f = ok(f, { type: 'answer', idx: 6, choice: 2 }, T0, allLevels);
    expect(f.job.active).toBeNull();
    expect(f.job.last).toMatchObject({ ok: false, reason: 'wrong', answered: 6, missed: { answer: 'A đúng' } });
    expect(f.coins).toBe(500 - offer.fee);
  });

  test('AC-09.3 trả lời ở giây 19,9 được; quá 20 giây là sai', () => {
    let f = ready();
    const offer = f.job.offers[0];
    f = ok(f, { type: 'acceptJob', offerId: offer.id }, T0, ctxQ(offer.level));
    f = ok(f, { type: 'answer', idx: 0, choice: 0 }, T0 + 19_900, allLevels);
    expect(f.job.active?.idx).toBe(1);
    f = ok(f, { type: 'answer', idx: 1, choice: 0 }, T0 + 19_900 + 20_001, allLevels);
    expect(f.job.active).toBeNull();
    expect(f.job.last?.reason).toBe('timeout');
  });

  test('AC-09.4 đóng mở giữ nguyên; đổi 15/30/60; mốc 8 giờ làm mới và phí về 15', () => {
    let f = ready();
    const ids = f.job.offers.map((o) => o.id);
    expect(view(f, T0 + H, allLevels).job.offers.map((o) => o.id)).toEqual(ids);
    const c = f.coins;
    f = ok(f, { type: 'rerollJobs' }, T0 + H, allLevels);
    f = ok(f, { type: 'rerollJobs' }, T0 + H, allLevels);
    f = ok(f, { type: 'rerollJobs' }, T0 + H, allLevels);
    expect(c - f.coins).toBe(15 + 30 + 60);
    const before = f.job.offers.map((o) => o.id);
    const v = view(f, T0 + 8 * H, allLevels);
    expect(v.job.offers.map((o) => o.id)).not.toEqual(before);
    expect(v.job.rerollCost).toBe(15);
  });

  test('AC-09.5 việc thứ 6 được, thứ 7 bị từ chối, ngày mới nhận lại được', () => {
    let f = ready(10_000);
    let t = T0;
    for (let i = 0; i < 6; i++) {
      if (f.job.offers.length === 0) f = ok(f, { type: 'rerollJobs' }, t, allLevels);
      const o = f.job.offers[0];
      f = ok(f, { type: 'acceptJob', offerId: o.id }, t, ctxQ(o.level));
      f = ok(f, { type: 'answer', idx: 0, choice: 3 }, t, allLevels); // sai ngay cho nhanh
      t += MIN;
    }
    if (f.job.offers.length === 0) f = ok(f, { type: 'rerollJobs' }, t, allLevels);
    const c = f.coins;
    const o = f.job.offers[0];
    const r = fail(f, { type: 'acceptJob', offerId: o.id }, t, 'job_limit', ctxQ(o.level));
    expect(r.farm.coins).toBe(c);
    const v = view(f, T0 + D, allLevels);
    const o2 = v.job.offers[0];
    ok(f, { type: 'acceptJob', offerId: o2.id }, T0 + D, ctxQ(o2.level));
  });

  test('AC-09.6 tắt app giữa chừng: mở lại thấy việc thất bại vì hết giờ', () => {
    let f = ready();
    const o = f.job.offers[0];
    f = ok(f, { type: 'acceptJob', offerId: o.id }, T0, ctxQ(o.level));
    for (let i = 0; i < 3; i++) f = ok(f, { type: 'answer', idx: i, choice: 0 }, T0, allLevels);
    const v = view(f, T0 + MIN, allLevels);
    expect(v.job.active).toBeNull();
    expect(v.job.last).toMatchObject({ ok: false, reason: 'timeout', answered: 3 });
  });

  test('AC-09.7 chỉ mức đủ 10 câu mới có việc; không mức nào đủ thì không có việc', () => {
    const f = newFarm(T0, 3, { levelCounts: { 1: 30, 2: 0, 3: 9 } });
    expect(f.job.offers.length).toBe(3);
    expect(f.job.offers.every((o) => o.level === 1)).toBe(true);
    const g = newFarm(T0, 3, { levelCounts: { 1: 0, 2: 0, 3: 9 } });
    expect(g.job.offers).toHaveLength(0);
  });

  test('AC-09.8 không lộ đáp án; trả lời lại bị bỏ qua; 10 câu không trùng; thiếu xu không đổi được', () => {
    let f = ready();
    const o = f.job.offers[0];
    f = ok(f, { type: 'acceptJob', offerId: o.id }, T0, ctxQ(o.level));
    const v = view(f, T0, allLevels);
    expect(JSON.stringify(v.job)).not.toContain('"correct"');
    expect(v.job.active?.question.options).toHaveLength(4);
    f = ok(f, { type: 'answer', idx: 0, choice: 0 }, T0, allLevels);
    const r = fail(f, { type: 'answer', idx: 0, choice: 2 }, T0, 'stale', allLevels);
    expect(r.farm.job.active?.idx).toBe(1);
    expect(new Set(f.job.active!.questions.map((q) => q.id)).size).toBe(10);
    const g = ready(3);
    fail(g, { type: 'rerollJobs' }, T0, 'no_coins', allLevels);
    fail(g, { type: 'acceptJob', offerId: g.job.offers.find((x) => x.fee > 3)!.id }, T0, 'no_coins', ctxQ(1));
  });

  test('AC-10.5 câu hỏi đã chụp lúc nhận việc, đổi ngân hàng không ảnh hưởng', () => {
    let f = ready();
    const o = f.job.offers[0];
    const qs = questions(o.level);
    f = ok(f, { type: 'acceptJob', offerId: o.id }, T0, { ...allLevels, questions: qs });
    qs[3].correct = 2; // quản trị sửa đáp án sau khi đã nhận việc
    qs.splice(4, 1);
    for (let i = 0; i < 10; i++) f = ok(f, { type: 'answer', idx: i, choice: 0 }, T0, allLevels);
    expect(f.job.last?.ok).toBe(true);
  });
});

describe('BR12 chất lượng', () => {
  test('AC-04.8 sức khoẻ 100 + phân tốt = 20%; sức khoẻ 0 không phân = 0%', () => {
    expect(harvestQualityChance(100, 'good')).toBeCloseTo(0.2, 10);
    expect(harvestQualityChance(0, null)).toBe(0);
    expect(harvestQualityChance(100, null)).toBeCloseTo(0.15, 10);
    // tần suất thật qua 10.000 lần thu với số ngẫu nhiên cố định
    let hq = 0;
    for (let i = 0; i < 10_000; i++) {
      const f = give(fresh(i), 'seed:rau_cai', 1);
      f.inventory['fert:good'] = { n: 1, hq: 0 };
      let g = ok(f, { type: 'plant', plotId: 0, cropId: 'rau_cai' }, T0);
      g = ok(g, { type: 'fertilize', plotId: 0, fertilizer: 'good' }, T0);
      g.plots[0].crop!.health = 100;
      g.plots[0].crop!.ripe = true;
      g = ok(g, { type: 'harvest', plotId: 0 }, T0);
      hq += g.inventory['crop:rau_cai'].hq;
    }
    expect(hq / 10_000).toBeGreaterThan(0.185);
    expect(hq / 10_000).toBeLessThan(0.215);
  });
});
