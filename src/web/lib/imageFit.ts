// Quy tắc thu nhỏ ảnh trước khi tải lên, dùng chung cho luồng riêng (shrink.worker.ts) và luồng chính (api.ts).
// Khung 1080p: cạnh dài tối đa 1920, cạnh ngắn tối đa 1080 (ảnh dọc là 1080 x 1920).
export const LONG_EDGE = 1920;
export const SHORT_EDGE = 1080;

/** Tỷ lệ cần thu. Trả về 1 khi ảnh đã nằm gọn trong khung 1080p: ảnh đó giữ nguyên file gốc, không mã hóa lại. */
export function fitScale(width: number, height: number): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return Math.min(1, LONG_EDGE / long, SHORT_EDGE / short);
}
