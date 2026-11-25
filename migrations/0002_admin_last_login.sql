-- Ghi lại lần đăng nhập gần nhất của người quản trị
ALTER TABLE admins ADD COLUMN last_login_at TEXT;
