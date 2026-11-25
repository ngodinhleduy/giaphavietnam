// Storage adapter. Hiện có: Google Drive (chạy được cả trên Workers và Node), local folder (Node, dùng cho NAS).
import type { DB } from './db.ts';

export interface Storage {
  kind: string;
  put(name: string, mime: string, data: Uint8Array): Promise<string>; // trả về remote_id
  get(remoteId: string): Promise<{ body: ReadableStream | Uint8Array; mime?: string } | null>;
  remove(remoteId: string): Promise<void>;
  check(): Promise<string>; // kiểm tra kết nối, trả về mô tả
}

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId?: string; // nếu trống: app tự tạo thư mục "GiaPha-Storage" và nhớ id trong settings
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';

export function googleDriveStorage(cfg: DriveConfig, db: DB): Storage {
  let token: { value: string; exp: number } | null = null;
  let folderId = cfg.folderId || '';

  async function accessToken(): Promise<string> {
    if (token && token.exp > Date.now() + 60_000) return token.value;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Google OAuth lỗi ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return token.value;
  }

  async function folder(): Promise<string> {
    if (folderId) return folderId;
    const saved = await db.first<{ value: string }>("SELECT value FROM settings WHERE key = 'gdrive_folder_id'");
    if (saved?.value) return (folderId = saved.value);
    const res = await fetch(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'GiaPha-Storage', mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!res.ok) throw new Error(`Không tạo được thư mục Drive: ${await res.text()}`);
    folderId = ((await res.json()) as { id: string }).id;
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('gdrive_folder_id', ?)", [folderId]);
    return folderId;
  }

  return {
    kind: 'gdrive',
    async put(name, mime, data) {
      const boundary = 'gp' + crypto.randomUUID().replace(/-/g, '');
      const meta = JSON.stringify({ name, parents: [await folder()] });
      const enc = new TextEncoder();
      const head = enc.encode(
        `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${mime}\r\n\r\n`,
      );
      const tail = enc.encode(`\r\n--${boundary}--`);
      const body = new Uint8Array(head.length + data.length + tail.length);
      body.set(head, 0);
      body.set(data, head.length);
      body.set(tail, head.length + data.length);
      const res = await fetch(UPLOAD, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await accessToken()}`,
          'content-type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });
      if (!res.ok) throw new Error(`Upload Drive lỗi ${res.status}: ${await res.text()}`);
      return ((await res.json()) as { id: string }).id;
    },
    async get(id) {
      const res = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media`, {
        headers: { authorization: `Bearer ${await accessToken()}` },
      });
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new Error(`Đọc Drive lỗi ${res.status}`);
      return { body: res.body, mime: res.headers.get('content-type') ?? undefined };
    },
    async remove(id) {
      await fetch(`${API}/files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${await accessToken()}` },
      });
    },
    async check() {
      const f = await folder();
      return `Google Drive OK, thư mục id: ${f}`;
    },
  };
}

// Dùng khi chưa cấu hình storage: báo lỗi rõ ràng thay vì im lặng.
export function noStorage(): Storage {
  const fail = async (): Promise<never> => {
    throw new Error('Chưa cấu hình storage. Xem README, mục "Kết nối Google Drive".');
  };
  return { kind: 'none', put: fail, get: fail, remove: fail, check: fail };
}
