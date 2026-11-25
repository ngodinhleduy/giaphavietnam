// Entry cho Cloudflare Workers. Static files (dist/) được Workers Assets phục vụ, /api/* chạy qua Hono.
import { createApp, type Deps } from './app.ts';
import { d1Adapter } from './db.ts';
import { googleDriveStorage, noStorage } from './storage.ts';

interface CfEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  GDRIVE_CLIENT_ID?: string;
  GDRIVE_CLIENT_SECRET?: string;
  GDRIVE_REFRESH_TOKEN?: string;
  GDRIVE_FOLDER_ID?: string;
  // Gắn tên miền riêng từ trang quản trị
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_WORKER_NAME?: string;
}

// Giữ deps (và access token Drive) giữa các request trong cùng isolate
let cached: { key: string; deps: Deps } | null = null;

function deps(env: CfEnv): Deps {
  const key = `${env.JWT_SECRET}|${env.GDRIVE_REFRESH_TOKEN ?? ''}|${env.GDRIVE_FOLDER_ID ?? ''}|${env.CF_API_TOKEN ?? ''}`;
  if (cached?.key === key) return { ...cached.deps, db: d1Adapter(env.DB) };
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('Thiếu JWT_SECRET (tối thiểu 32 ký tự).');
  const db = d1Adapter(env.DB);
  const storage =
    env.GDRIVE_CLIENT_ID && env.GDRIVE_CLIENT_SECRET && env.GDRIVE_REFRESH_TOKEN
      ? googleDriveStorage(
          {
            clientId: env.GDRIVE_CLIENT_ID,
            clientSecret: env.GDRIVE_CLIENT_SECRET,
            refreshToken: env.GDRIVE_REFRESH_TOKEN,
            folderId: env.GDRIVE_FOLDER_ID,
          },
          db,
        )
      : noStorage();
  const cloudflare = env.CF_ACCOUNT_ID
    ? { token: env.CF_API_TOKEN ?? '', accountId: env.CF_ACCOUNT_ID, worker: env.CF_WORKER_NAME || 'giaphavietnam' }
    : undefined;
  const d = { db, storage, secret: env.JWT_SECRET, cloudflare };
  cached = { key, deps: d };
  return d;
}

const app = createApp((c) => deps(c.env as unknown as CfEnv));

export default {
  async fetch(req: Request, env: CfEnv, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return app.fetch(req, env, ctx);
    // SPA fallback do wrangler.toml cấu hình (not_found_handling = single-page-application)
    return env.ASSETS.fetch(req);
  },
};
