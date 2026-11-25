// Chuyển toàn bộ file từ Google Drive về thư mục local/NAS. Chạy khi đã chuyển sang Docker trên NAS:
//   docker compose exec giapha node --experimental-strip-types scripts/migrate-storage.ts
// Cần đủ biến GDRIVE_* (để đọc) và STORAGE_DIR (để ghi). File trên Drive được giữ nguyên, bạn tự xóa sau khi kiểm tra.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openNodeDb } from '../src/server/db-node.ts';
import { googleDriveStorage } from '../src/server/storage.ts';
import { localStorage } from '../src/server/storage-local.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const db = openNodeDb(env.DB_FILE ?? join(root, 'data/giapha.db'), join(root, 'migrations'));
if (!env.GDRIVE_REFRESH_TOKEN) throw new Error('Thiếu GDRIVE_REFRESH_TOKEN.');
const drive = googleDriveStorage(
  { clientId: env.GDRIVE_CLIENT_ID!, clientSecret: env.GDRIVE_CLIENT_SECRET!, refreshToken: env.GDRIVE_REFRESH_TOKEN },
  db,
);
const local = localStorage(env.STORAGE_DIR ?? join(root, 'data/uploads'));

const files = await db.all<any>("SELECT * FROM files WHERE storage = 'gdrive'");
console.log(`Có ${files.length} file trên Drive.`);
let ok = 0;
for (const f of files) {
  try {
    const obj = await drive.get(f.remote_id);
    if (!obj) throw new Error('không còn trên Drive');
    const bytes = obj.body instanceof Uint8Array ? obj.body : new Uint8Array(await new Response(obj.body).arrayBuffer());
    const rel = await local.put(f.name, f.mime, bytes);
    await db.run("UPDATE files SET storage = 'local', remote_id = ? WHERE id = ?", [rel, f.id]);
    ok++;
    console.log(`  ✓ ${f.name}`);
  } catch (e: any) {
    console.error(`  ✗ ${f.name}: ${e.message}`);
  }
}
console.log(`Xong: ${ok}/${files.length}. Đặt STORAGE=local rồi khởi động lại.`);
