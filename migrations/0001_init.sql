-- Gia phả: schema v1. Chạy được trên SQLite (Node) và Cloudflare D1.

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- File đã upload. storage = 'gdrive' | 'local'. remote_id = id trên Drive hoặc đường dẫn tương đối trên NAS.
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storage TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Thành viên. is_blood = 1: người mang huyết thống dòng họ; 0: dâu/rể.
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  alias TEXT,                 -- tên tự / tên húy / thụy hiệu
  gender TEXT NOT NULL CHECK (gender IN ('male','female')),
  generation INTEGER,         -- đời thứ mấy (tính tự động từ cha/mẹ, có thể ghi đè)
  father_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  mother_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  birth_order INTEGER,        -- thứ tự trong anh chị em (con trưởng = 1)
  is_blood INTEGER NOT NULL DEFAULT 1,
  is_deceased INTEGER NOT NULL DEFAULT 0,
  birth_date TEXT,            -- YYYY-MM-DD hoặc YYYY
  death_date TEXT,
  death_lunar_day INTEGER,    -- ngày giỗ âm lịch
  death_lunar_month INTEGER,
  burial_place TEXT,
  hometown TEXT,
  occupation TEXT,
  branch TEXT,                -- chi / nhánh
  bio TEXT,
  photo_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_father ON members(father_id);
CREATE INDEX IF NOT EXISTS idx_members_mother ON members(mother_id);
CREATE INDEX IF NOT EXISTS idx_members_generation ON members(generation);

CREATE TABLE IF NOT EXISTS marriages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  husband_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  wife_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL DEFAULT 1,  -- vợ cả = 1, vợ thứ = 2...
  note TEXT,
  UNIQUE (husband_id, wife_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,               -- Markdown
  cover_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sự kiện. calendar = 'solar' | 'lunar'. year NULL + recurring = 1: lặp hằng năm.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  calendar TEXT NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar','lunar')),
  day INTEGER NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER,
  recurring INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  cover_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  caption TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_name', 'Gia phả dòng họ'),
  ('site_tagline', 'Uống nước nhớ nguồn'),
  ('intro', 'Trang gia phả lưu giữ thế thứ, phả ký và những sự kiện của dòng họ.'),
  ('address', ''),
  ('map_embed', ''),
  ('contact', ''),
  ('viewer_passcode_hash', '');

INSERT OR IGNORE INTO categories (slug, name, sort) VALUES
  ('pha-ky', 'Phả ký', 1),
  ('lich-su', 'Lịch sử dòng họ', 2),
  ('nhan-vat', 'Nhân vật tiêu biểu', 3),
  ('thong-bao', 'Thông báo', 4);
