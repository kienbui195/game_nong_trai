// Số ngẫu nhiên xác định: cùng hạt giống + cùng khoá thì ra cùng số.
// Nhờ vậy tính bù một lần hay chia nhiều lần đều ra cùng kết quả (AC-12.3).

/** cyrb53: băm chuỗi thành số 53 bit. */
function hash(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Số trong [0, 1) từ hạt giống và các khoá. */
export function rand(seed: number, ...keys: (string | number)[]): number {
  return hash(keys.join('|'), seed) / 2 ** 53;
}

/** Số nguyên trong [lo, hi]. */
export function randInt(seed: number, lo: number, hi: number, ...keys: (string | number)[]): number {
  return lo + Math.floor(rand(seed, ...keys) * (hi - lo + 1));
}
