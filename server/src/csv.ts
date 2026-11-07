// Đọc / ghi CSV (RFC 4180). Cột giống hệt Căn Góc Toạ Độ để file dùng qua lại được.
export const BOM = '﻿';

export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  // Excel tiếng Việt hay lưu bằng dấu chấm phẩy: dòng đầu có ; mà không có , thì dùng ;
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const endRow = () => {
    row.push(cell);
    cell = '';
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') endRow();
    else if (ch === '\r') {
      if (src[i + 1] === '\n') i++;
      endRow();
    } else cell += ch;
  }
  if (inQuotes) throw new Error('CSV có dấu ngoặc kép chưa đóng.');
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

const esc = (v: unknown) => {
  let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // chặn công thức khi mở bằng Excel
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: unknown[][]) => BOM + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
