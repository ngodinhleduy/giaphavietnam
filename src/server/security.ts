// Các lớp bảo vệ dùng chung: giới hạn số lần thử, kiểm tra nguồn gọi, loại file được tải lên, che thông tin người còn sống.
import type { DB } from './db.ts';

// ---------- Giới hạn số lần thử ----------
const CREATE = `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL)`;
let tableReady = false;
async function ensureTable(db: DB) {
  if (tableReady) return;
  await db.run(CREATE);
  tableReady = true;
}

export type Limit = { max: number; windowSec: number };
// Bộ đếm là lớp bảo vệ thêm. Nếu chính nó gặp lỗi (ví dụ database tạm thời không ghi được) thì cho qua và ghi log,
// để một trục trặc ở đây không khóa mọi người khỏi việc đăng nhập.
const failOpen = async <T>(run: () => Promise<T>, whenBroken: T): Promise<T> => {
  try { return await run(); } catch (e) { console.error('[rate-limit]', e); return whenBroken; }
};
/** Còn được thử hay không. Không tăng bộ đếm. */
export const allowed = (db: DB, key: string, limit: Limit): Promise<boolean> => failOpen(async () => {
  await ensureTable(db);
  const row = await db.first<{ count: number; reset_at: number }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', [key]);
  return !row || row.reset_at <= Date.now() || row.count < limit.max;
}, true);
/** Ghi nhận một lần thử. Trả về true nếu lần này vẫn nằm trong giới hạn. */
export const hit = (db: DB, key: string, limit: Limit): Promise<boolean> => failOpen(async () => {
  await ensureTable(db);
  const now = Date.now();
  const next = now + limit.windowSec * 1000;
  const row = await db.first<{ count: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
     RETURNING count`,
    [key, next, now, now, next],
  );
  // Thỉnh thoảng dọn các dòng đã hết hạn để bảng không phình ra
  if (Math.random() < 0.02) await db.run('DELETE FROM rate_limits WHERE reset_at < ?', [now - 86_400_000]);
  return (row?.count ?? 1) <= limit.max;
}, true);
export const clearLimit = (db: DB, key: string): Promise<void> => failOpen(async () => {
  await ensureTable(db);
  await db.run('DELETE FROM rate_limits WHERE key = ?', [key]);
}, undefined);

/** Mã băm ngắn của một giá trị, trộn với khóa bí mật của máy chủ. Dùng thay cho địa chỉ mạng thật trong bộ đếm. */
export async function fingerprint(secret: string, value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}|${value}`));
  return [...new Uint8Array(buf).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Địa chỉ mạng của người gọi. Cloudflare điền cf-connecting-ip; sau proxy khác thì lấy mục đầu của x-forwarded-for. */
export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

// ---------- Nguồn gọi ----------
/** Lệnh thay đổi dữ liệu phải đến từ chính trang này. Trình duyệt luôn gửi Origin cho POST, PUT, DELETE từ trang khác. */
export function sameOrigin(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = req.headers.get('origin');
  if (!origin) return true; // công cụ dòng lệnh, không phải trình duyệt
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
    return new URL(origin).host === host;
  } catch { return false; }
}

// ---------- File tải lên ----------
/** Chỉ nhận ảnh và PDF. Loại file xác định bằng chữ ký ở đầu file, không tin phần khai của trình duyệt. */
export function sniffUpload(bytes: Uint8Array): string | null {
  const b = bytes;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, 32))) return 'image/avif';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'image/x-icon';
  // SVG là văn bản: tìm thẻ <svg trong 1 KB đầu. Khi trả về, file luôn kèm chính sách chặn chạy mã (xem FILE_HEADERS).
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.slice(0, 1024)).replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return null;
}
export const SAFE_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml', 'image/x-icon', 'application/pdf'];
/** Header kèm mọi file trả về: không cho trình duyệt đoán loại, không cho mã trong file (SVG, PDF) chạy với quyền của trang. */
export const FILE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'cross-origin-resource-policy': 'same-origin',
};

// ---------- Thông tin người còn sống ----------
/** Với người xem không phải quản lý: người còn sống chỉ lộ năm sinh, không lộ ngày sinh đầy đủ, quê quán, nghề nghiệp. */
export function maskLiving<T extends Record<string, any>>(m: T): T {
  if (!m || m.is_deceased) return m;
  const out: Record<string, any> = { ...m };
  if (typeof out.birth_date === 'string' && out.birth_date.length > 4) out.birth_date = out.birth_date.slice(0, 4);
  if ('hometown' in out) out.hometown = null;
  if ('occupation' in out) out.occupation = null;
  return out as T;
}

/** Số nguyên từ tham số truy vấn, có mặc định và trần. Tránh đưa NaN vào câu SQL. */
export function intParam(v: string | undefined, def: number, max: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : def;
}
