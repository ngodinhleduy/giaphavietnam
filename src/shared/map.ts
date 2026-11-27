// Nhận mọi thứ người dùng hay dán vào ô bản đồ, trả về địa chỉ nhúng được và đường dẫn mở Google Maps.
// Chấp nhận: thẻ <iframe> của "Nhúng bản đồ", đường dẫn trang Google Maps (có tọa độ), đường dẫn rút gọn, hoặc địa chỉ gõ tay.

const GOOGLE_HOSTS = /(^|\.)google\.[a-z.]+$/i;

/** Lấy giá trị cần lưu: dán cả thẻ iframe thì chỉ giữ địa chỉ trong src. Cắt ở 1000 ký tự. */
export function cleanMapInput(v: unknown): string {
  const s = String(v ?? '').trim();
  return (s.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? s).trim().slice(0, 1000);
}

const query = (q: string) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;

/**
 * Địa chỉ đặt vào iframe, hoặc null khi không có gì để hiện.
 * @param value giá trị ô bản đồ
 * @param address địa chỉ gõ tay, dùng khi value trống hoặc là đường dẫn không nhúng được
 */
export function mapEmbedUrl(value: string | null | undefined, address?: string | null): string | null {
  const v = cleanMapInput(value);
  const addr = String(address ?? '').trim();
  if (!v) return addr ? query(addr) : null;
  if (!/^https?:\/\//i.test(v)) return query(v); // gõ địa chỉ thường
  let u: URL;
  try { u = new URL(v); } catch { return addr ? query(addr) : null; }
  // Chỉ nhúng trang của Google. Đường dẫn nơi khác không đưa vào iframe.
  if (u.protocol === 'https:' && GOOGLE_HOSTS.test(u.hostname)) {
    if (u.pathname.startsWith('/maps/embed') || u.searchParams.get('output') === 'embed') return u.toString();
    // Trang Google Maps thường: lấy tọa độ ghim (!3d..!4d..) hoặc tâm bản đồ (@lat,lng)
    const pin = v.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? v.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (pin) return query(`${pin[1]},${pin[2]}`);
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    if (q) return query(q);
    const place = u.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
    if (place) return query(decodeURIComponent(place.replace(/\+/g, ' ')));
  }
  // Đường dẫn rút gọn (maps.app.goo.gl) không nhúng được và không đọc được tọa độ: dùng địa chỉ gõ tay nếu có
  return addr ? query(addr) : null;
}

/** Đường dẫn để mở trong Google Maps (tab mới). */
export function mapOpenUrl(value: string | null | undefined, address?: string | null): string | null {
  const v = cleanMapInput(value);
  const addr = String(address ?? '').trim();
  if (/^https:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const short = /(^|\.)goo\.gl$/i.test(u.hostname);
      if (short || (GOOGLE_HOSTS.test(u.hostname) && !u.pathname.startsWith('/maps/embed') && u.searchParams.get('output') !== 'embed')) return u.toString();
    } catch { /* bỏ qua */ }
  }
  const q = addr || (!/^https?:\/\//i.test(v) ? v : '');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
