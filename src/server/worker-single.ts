// Bản Worker một file: giao diện (dist/) được nhúng sẵn, dùng khi deploy qua dashboard Cloudflare không có wrangler.
import worker from './worker.ts';
// @ts-ignore: file sinh ra bởi scripts/build-single.ts
import { ASSETS } from './_assets.gen.js';

const types: Record<string, string> = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', html: 'text/html; charset=utf-8' };
const serve = (path: string) => {
  const body = (ASSETS as Record<string, string>)[path];
  if (body == null) return null;
  const ext = path.split('.').pop() ?? 'html';
  return new Response(body, {
    headers: {
      'content-type': types[ext] ?? 'application/octet-stream',
      'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  });
};

export default {
  async fetch(req: Request, env: any, ctx: ExecutionContext) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith('/api/')) return worker.fetch(req, { ...env, ASSETS: undefined }, ctx);
    return serve(pathname) ?? serve('/index.html')!;
  },
};
