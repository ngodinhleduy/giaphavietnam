// Cột mới thêm sau bản đầu. Tự thêm khi thiếu, để không phải chạy tay lệnh ALTER trên Cloudflare D1.
import type { DB } from './db.ts';

const COLUMNS: Record<string, Record<string, string>> = {
  events: { map: 'TEXT' },          // vị trí Google Maps của nơi tổ chức
  members: { burial_map: 'TEXT' },  // vị trí Google Maps của nơi an nghỉ
};

let ready = false;
/** Chạy một lần cho mỗi tiến trình. Lỗi ở đây không được làm hỏng yêu cầu đang xử lý. */
export async function ensureSchema(db: DB) {
  if (ready) return;
  for (const [table, cols] of Object.entries(COLUMNS)) {
    let have: Set<string> | null = null;
    try {
      have = new Set((await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((r) => r.name));
    } catch { /* không đọc được cấu trúc bảng: thử thêm thẳng, cột đã có thì lệnh báo lỗi và được bỏ qua */ }
    for (const [col, type] of Object.entries(cols)) {
      if (have?.has(col)) continue;
      try { await db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); }
      catch (e) { if (!/duplicate column/i.test(String(e))) console.error('[schema]', table, col, e); }
    }
  }
  ready = true;
}
