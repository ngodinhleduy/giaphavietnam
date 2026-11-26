import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  status: number;
  locked: boolean;
  constructor(status: number, message: string, locked = false) {
    super(message);
    this.status = status;
    this.locked = locked;
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  const isJson = res.headers.get('content-type')?.includes('json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? `Lỗi ${res.status}`, !!(data as any)?.locked);
  return data as T;
}

export const api = {
  get: <T>(p: string) => req<T>('GET', p),
  post: <T>(p: string, b?: unknown) => req<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => req<T>('PUT', p, b ?? {}),
  del: <T>(p: string) => req<T>('DELETE', p),
  async upload(file: File | Blob, name?: string): Promise<{ id: number; name: string }> {
    const fd = new FormData();
    fd.append('file', file, name ?? (file as File).name ?? 'file');
    return req('POST', '/admin/upload', fd);
  },
};

export const fileUrl = (id?: number | null) => (id ? `/api/files/${id}` : '');

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

// ---------- Thu nhỏ ảnh trước khi upload ----------
let shrinker: Worker | null | undefined;
let jobId = 0;
const waiting = new Map<number, (r: { ok: boolean; blob: Blob | null; ext: string }) => void>();
function shrinkWorker(): Worker | null {
  if (shrinker !== undefined) return shrinker;
  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('no OffscreenCanvas');
    const w = new Worker(new URL('./shrink.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
    w.onerror = () => { shrinker = null; for (const r of waiting.values()) r({ ok: false, blob: null, ext: '' }); waiting.clear(); };
    shrinker = w;
  } catch { shrinker = null; }
  return shrinker;
}
const skip = (f: File) => !f.type.startsWith('image/') || f.type === 'image/gif' || f.type === 'image/svg+xml';

/** Thu nhỏ trên luồng chính. Chỉ dùng khi trình duyệt không chạy được luồng riêng. */
async function shrinkHere(file: File, max: number, quality: number): Promise<File> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 600_000) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/** Thu nhỏ ảnh trước khi upload: file nhẹ hơn thì gửi nhanh hơn và đỡ tốn dung lượng Drive/NAS.
    Chạy trong luồng riêng nên trang không khựng; ảnh ra dạng WebP nếu trình duyệt hỗ trợ, không thì JPEG. */
export async function shrinkImage(file: File, max = 1600, quality = 0.82): Promise<File> {
  if (skip(file)) return file;
  const w = shrinkWorker();
  if (!w) return shrinkHere(file, max, quality);
  const id = ++jobId;
  const r = await new Promise<{ ok: boolean; blob: Blob | null; ext: string }>((res) => { waiting.set(id, res); w.postMessage({ id, file, max, quality }); });
  if (!r.ok) return shrinkHere(file, max, quality);
  if (!r.blob) return file;
  return new File([r.blob], file.name.replace(/\.[^.]+$/, '') + r.ext, { type: r.blob.type });
}

/** Chạy một việc cho từng phần tử, tối đa `limit` việc cùng lúc, giữ nguyên thứ tự kết quả. Lỗi trả về null. */
export async function pool<T, R>(items: T[], limit: number, run: (item: T, i: number) => Promise<R>, onDone?: () => void): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await run(items[i], i); } catch { out[i] = null; }
      onDone?.();
    }
  }));
  return out;
}
