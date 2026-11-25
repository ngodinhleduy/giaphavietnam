// Lưu file vào một thư mục trên máy (dùng cho NAS: mount thư mục NAS vào container rồi trỏ STORAGE_DIR tới đó).
import { mkdir, writeFile, readFile, unlink, access } from 'node:fs/promises';
import { join, normalize, dirname } from 'node:path';
import type { Storage } from './storage.ts';

export function localStorage(root: string): Storage {
  const safe = (rel: string) => {
    const p = normalize(join(root, rel));
    if (!p.startsWith(normalize(root))) throw new Error('Đường dẫn không hợp lệ');
    return p;
  };
  return {
    kind: 'local',
    async put(name, _mime, data) {
      const d = new Date();
      const ext = (name.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? '').toLowerCase();
      const rel = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}${ext}`;
      const p = safe(rel);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, data);
      return rel;
    },
    async get(rel) {
      try {
        return { body: new Uint8Array(await readFile(safe(rel))) };
      } catch {
        return null;
      }
    },
    async remove(rel) {
      await unlink(safe(rel)).catch(() => {});
    },
    async check() {
      await mkdir(root, { recursive: true });
      await access(root);
      return `Local storage OK: ${root}`;
    },
  };
}
