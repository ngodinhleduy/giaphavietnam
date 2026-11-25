// Nạp file SQL xuất từ D1 vào SQLite. Dùng khi chuyển từ Cloudflare sang NAS:
//   node --experimental-strip-types scripts/import-sql.ts giapha.sql
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const file = process.argv[2];
const target = process.env.DB_FILE ?? 'data/giapha.db';
if (!file) throw new Error('Cách dùng: import-sql.ts <file.sql>');
if (existsSync(target)) throw new Error(`${target} đã tồn tại. Xóa hoặc đổi tên trước khi nạp.`);
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(target, { enableForeignKeyConstraints: false }); // file export không theo thứ tự khóa ngoại
db.exec(readFileSync(file, 'utf8'));
db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY); INSERT OR IGNORE INTO _migrations VALUES ('0001_init.sql');");
const n = db.prepare('SELECT COUNT(*) AS n FROM members').get() as { n: number };
console.log(`Đã nạp vào ${target}: ${n.n} thành viên.`);
