-- Vai trò tài khoản (admin | editor), giới hạn theo chi, người viết bài, hòm thư từ trang xem
ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN branch TEXT;
ALTER TABLE articles ADD COLUMN author_name TEXT;
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT, subject TEXT, body TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
