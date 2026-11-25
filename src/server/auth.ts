// Hash mật khẩu (PBKDF2) và ký token phiên (HMAC-SHA256). Chỉ dùng WebCrypto nên chạy được trên Workers và Node.
const enc = new TextEncoder();
const ITER = 100_000; // giới hạn tối đa của Workers

const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64u = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) =>
    c.charCodeAt(0),
  );

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64u(salt)}$${b64u(await pbkdf2(password, salt, ITER))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iter, salt, hash] = (stored || '').split('$');
  if (algo !== 'pbkdf2' || !hash) return false;
  const got = b64u(await pbkdf2(password, fromB64u(salt), Number(iter)));
  if (got.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export type TokenPayload = { sub: string; role: 'admin' | 'viewer'; exp: number; v?: string };

export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}

export async function verifyToken(token: string | undefined, secret: string): Promise<TokenPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64u(sig), enc.encode(body));
  if (!ok) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body))) as TokenPayload;
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
