-- Ba trường còn thiếu so với CMS gốc, và nhật ký thao tác của người quản trị
ALTER TABLE members ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;            -- 1: ẩn trên trang xem
ALTER TABLE members ADD COLUMN title_role TEXT;                                 -- chức danh, vai vế (Cụ Tổ, Mệ Đích...)
ALTER TABLE members ADD COLUMN child_type TEXT NOT NULL DEFAULT 'biological';   -- biological | adopted | out_of_wedlock

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  admin_name TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at);
