// Header bảo mật cho mọi trang HTML và file tĩnh. Một nguồn duy nhất:
// - bản Cloudflare: vite.config.ts ghi ra dist/_headers khi build;
// - bản Node (NAS, VPS): src/server/node.ts gắn trực tiếp.

/** Chính sách nguồn nội dung. Chỉ chạy mã của chính trang; ảnh, khung nhúng (bản đồ) và kết nối ngoài chỉ qua https. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React đặt style nội tuyến cho vị trí, kích thước; Google Fonts cấp file CSS của phông chữ
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "frame-src https:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Không cho trang khác nhúng trang này vào khung (chống lừa bấm)
  "frame-ancestors 'none'",
].join('; ');

export const SITE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000',
  // Gia phả là dữ liệu riêng của dòng họ: không cho công cụ tìm kiếm và công cụ thu thập lập chỉ mục
  'X-Robots-Tag': 'noindex, nofollow, noarchive, noimageindex',
};

/** Nội dung file _headers của Cloudflare Workers Static Assets. */
export const headersFile = () => ['/*', ...Object.entries(SITE_HEADERS).map(([k, v]) => `  ${k}: ${v}`), ''].join('\n');
