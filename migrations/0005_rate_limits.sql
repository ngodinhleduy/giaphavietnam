-- Bộ đếm chống dò mật khẩu, dò mã xem và gửi thư hàng loạt.
-- key là mã băm của địa chỉ mạng hoặc tên đăng nhập, không lưu địa chỉ thật.
-- Trên Cloudflare D1 bảng này tự được tạo khi cần (xem src/server/security.ts), không phải chạy tay.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
