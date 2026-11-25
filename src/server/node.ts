// Entry cho Node (Docker trên VPS hoặc NAS).
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { openNodeDb } from './db-node.ts';
import { googleDriveStorage, noStorage, type Storage } from './storage.ts';
import { localStorage } from './storage-local.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const env = process.env;

const secret = env.JWT_SECRET ?? (env.NODE_ENV === 'production' ? '' : 'dev-secret-dev-secret-dev-secret-0000');
if (secret.length < 32) {
  console.error('Thiếu JWT_SECRET (tối thiểu 32 ký tự).');
  process.exit(1);
}

const db = openNodeDb(env.DB_FILE ?? join(root, 'data/giapha.db'), join(root, 'migrations'));

// Mọi storage đã cấu hình đều dùng được để đọc; STORAGE quyết định nơi ghi file mới.
const readers: Record<string, Storage> = {
  local: localStorage(env.STORAGE_DIR ?? join(root, 'data/uploads')),
};
if (env.GDRIVE_REFRESH_TOKEN)
  readers.gdrive = googleDriveStorage(
    {
      clientId: env.GDRIVE_CLIENT_ID ?? '',
      clientSecret: env.GDRIVE_CLIENT_SECRET ?? '',
      refreshToken: env.GDRIVE_REFRESH_TOKEN,
      folderId: env.GDRIVE_FOLDER_ID,
    },
    db,
  );
const kind = env.STORAGE ?? (readers.gdrive ? 'gdrive' : 'local');
const storage: Storage = readers[kind] ?? noStorage();
console.log(`[storage] ghi vào: ${storage.kind}; đọc được: ${Object.keys(readers).join(', ')}`);

const api = createApp(() => ({ db, storage, secret, readers }));
const app = new Hono();
app.route('/', api);

const dist = join(root, 'dist');
if (existsSync(dist)) {
  const rel = relative(process.cwd(), dist) || '.';
  app.use('/assets/*', serveStatic({ root: rel }));
  app.use('*', serveStatic({ root: rel }));
  // SPA fallback. Đọc lại mỗi lần để không bị lệch sau khi build lại.
  app.get('*', (c) => c.html(readFileSync(join(dist, 'index.html'), 'utf8')));
}

const port = Number(env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`[giapha] http://localhost:${port}`));
