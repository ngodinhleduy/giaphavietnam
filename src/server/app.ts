import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { DB } from './db.ts';
import type { Storage } from './storage.ts';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.ts';
import { buildCtx, kinship } from '../shared/kinship.ts';
import { nextSolarOfLunar, lunarToSolar, startOfDay } from '../shared/lunar.ts';
import { slugify } from '../shared/slug.ts';
import { menuLinks, parseMenu } from '../shared/menu.ts';
import { parsePeople, safeUrl, templateOf } from '../shared/site.ts';
import { DomainError, cleanDomain, cloudflareDomains, type CloudflareConfig } from './domain.ts';
import { FILE_HEADERS, SAFE_MIME, allowed, clearLimit, clientIp, fingerprint, hit, intParam, maskLiving, sameOrigin, sniffUpload, type Limit } from './security.ts';

/** storage: nơi lưu file mới. readers: các storage khác để đọc file cũ (ví dụ ảnh còn trên Drive sau khi chuyển sang NAS). */
export type Deps = {
  db: DB; storage: Storage; secret: string; readers?: Record<string, Storage>;
  /** Chỉ có khi chạy trên Cloudflare Workers. token rỗng: chưa khai API token. */
  cloudflare?: CloudflareConfig;
};
type Role = 'admin' | 'editor';
type Env = { Variables: { deps: Deps; adminId?: number; role?: Role; branch?: string | null } };
type C = Context<Env>;

const ADMIN_COOKIE = 'gp_admin';
const VIEW_COOKIE = 'gp_view';
const DAY = 86_400_000;
const MAX_UPLOAD = 15 * 1024 * 1024;

const PUBLIC_SETTINGS = ['site_name', 'site_tagline', 'intro', 'address', 'map_embed', 'contact', 'template',
  'contact_intro', 'contact_people', 'contact_email', 'contact_phone', 'contact_zalo', 'contact_facebook', 'contact_youtube', 'contact_tiktok', 'contact_form', 'foreword', 'tree_lines'];
const FILE_SETTINGS = ['logo_file_id', 'banner_file_id', 'intro_image_file_id', 'favicon_file_id'];
const MEMBER_FIELDS = [
  'full_name', 'alias', 'gender', 'generation', 'father_id', 'mother_id', 'birth_order', 'is_blood',
  'is_deceased', 'birth_date', 'death_date', 'death_lunar_day', 'death_lunar_month', 'burial_place',
  'hometown', 'occupation', 'branch', 'bio', 'photo_file_id', 'is_hidden', 'title_role', 'child_type',
] as const;
const CHILD_TYPES = ['biological', 'adopted', 'out_of_wedlock'];
// Chuẩn hóa ba trường mới để không ghi NULL vào cột NOT NULL
const normMember = (b: any) => ({
  ...b,
  is_hidden: b.is_hidden === true || Number(b.is_hidden) === 1 ? 1 : 0,
  child_type: CHILD_TYPES.includes(b.child_type) ? b.child_type : 'biological',
  title_role: String(b.title_role ?? '').trim() || null,
});

// Tên gọi của từng nhóm dữ liệu trong nhật ký
const LOG_RES: Record<string, { label: string; table?: string; col?: string; only?: string[] }> = {
  members: { label: 'thành viên', table: 'members', col: 'full_name' },
  marriages: { label: 'hôn nhân' },
  articles: { label: 'bài viết', table: 'articles', col: 'title' },
  categories: { label: 'chuyên mục', table: 'categories', col: 'name' },
  events: { label: 'sự kiện', table: 'events', col: 'title' },
  albums: { label: 'album', table: 'albums', col: 'title' },
  photos: { label: 'ảnh trong album' },
  settings: { label: 'cài đặt' },
  featured: { label: 'bài viết nổi bật' },
  admins: { label: 'tài khoản', table: 'admins', col: 'username' },
  password: { label: 'của chính mình' },
  menu: { label: 'menu website' },
  domain: { label: 'tên miền' },
  messages: { label: 'thư trong hòm thư', table: 'messages', col: 'name', only: ['DELETE'] },
};
// Biên tập viên không được đụng tới các nhóm này
const ADMIN_ONLY = ['settings', 'admins', 'logs', 'menu', 'messages', 'categories', 'storage', 'recompute-generations', 'import-url', 'domain', 'featured'];
const IMPORT_MAX = 25;
// Giới hạn số lần thử. Đếm theo địa chỉ mạng (đã băm) và theo tên đăng nhập.
const LIMITS = {
  loginUserIp: { max: 8, windowSec: 15 * 60 }, // sai 8 lần cho một tên từ cùng một địa chỉ: khóa 15 phút
  loginUser: { max: 40, windowSec: 15 * 60 },  // trần cho một tên từ mọi địa chỉ. Cao hơn để kẻ lạ khó khóa nhầm chủ tài khoản
  loginIp: { max: 30, windowSec: 15 * 60 },
  unlockIp: { max: 10, windowSec: 15 * 60 },   // dò mã xem phả đồ
  unlockAll: { max: 200, windowSec: 60 * 60 }, // dò mã từ nhiều địa chỉ cùng lúc
  messageIp: { max: 5, windowSec: 10 * 60 },
  profileIp: { max: 240, windowSec: 10 * 60 }, // mở hồ sơ thành viên: đủ cho người xem thật, chặn máy quét toàn bộ
  exportIp: { max: 6, windowSec: 60 * 60 },
} satisfies Record<string, Limit>;
const MIN_PASSCODE = 6;
const IMPORT_HOSTS = ['s3.cloudzone.vn'];

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const bad = (msg: string) => new HttpError(400, msg);
// Mã băm của một mật khẩu ngẫu nhiên đã bỏ đi: dùng khi tên đăng nhập không tồn tại
const DUMMY_HASH = 'pbkdf2$100000$c2FsdC1ub3QtdXNlZC0wMQ$3q2-7wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function createApp(resolveDeps: (c: C) => Deps | Promise<Deps>) {
  const app = new Hono<Env>().basePath('/api');

  app.use('*', async (c, next) => {
    c.set('deps', await resolveDeps(c));
    await next();
  });

  // Mọi phản hồi của API: không cho công cụ tìm kiếm lập chỉ mục, không cho bộ nhớ đệm dùng chung giữ dữ liệu cá nhân.
  // Lệnh thay đổi dữ liệu phải đến từ chính trang này (chống giả mạo yêu cầu từ trang khác).
  app.use('*', async (c, next) => {
    if (!sameOrigin(c.req.raw)) return c.json({ error: 'Yêu cầu không hợp lệ.' }, 403);
    await next();
    const h = c.res.headers;
    h.set('x-content-type-options', 'nosniff');
    h.set('x-robots-tag', 'noindex, nofollow, noarchive');
    h.set('referrer-policy', 'same-origin');
    if (!h.has('cache-control')) h.set('cache-control', 'private, no-store');
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as any);
    // Lỗi không lường trước: ghi vào log máy chủ, không trả chi tiết (câu SQL, lỗi của Drive...) ra ngoài
    console.error(err);
    return c.json({ error: 'Máy chủ gặp lỗi. Vui lòng thử lại sau.' }, 500);
  });

  const db = (c: C) => c.get('deps').db;
  const secure = (c: C) => new URL(c.req.url).protocol === 'https:';

  async function settingsMap(c: C) {
    const rows = await db(c).all<{ key: string; value: string }>('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
  }

  const adminToken = async (c: C) => {
    const p = await verifyToken(getCookie(c, ADMIN_COOKIE), c.get('deps').secret);
    return p?.role === 'admin' ? p : null;
  };
  /** Mã số tài khoản đang đăng nhập, hoặc null. Phiên chỉ còn giá trị khi mật khẩu chưa đổi kể từ lúc đăng nhập. */
  async function isAdmin(c: C) {
    const p = await adminToken(c);
    if (!p) return null;
    const u = await db(c).first<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = ?', [Number(p.sub)]);
    return u && p.v === hashTail(u.password_hash) ? Number(p.sub) : null;
  }
  /** Đuôi của mã băm mật khẩu, ghi vào phiên đăng nhập. Đổi mật khẩu thì mọi phiên cũ mất hiệu lực. */
  const hashTail = (hash: string) => String(hash ?? '').slice(-12);
  const issueAdminCookie = async (c: C, id: number, passwordHash: string) => {
    const token = await signToken({ sub: String(id), role: 'admin', exp: Date.now() + 7 * DAY, v: hashTail(passwordHash) }, c.get('deps').secret);
    setCookie(c, ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: secure(c), path: '/', maxAge: 7 * 86400 });
  };
  /** Khóa bộ đếm theo địa chỉ mạng của người gọi (đã băm, không lưu địa chỉ thật). */
  const ipKey = async (c: C, scope: string) => `${scope}:${await fingerprint(c.get('deps').secret, clientIp(c.req.raw.headers))}`;
  const tooMany = (what: string) => new HttpError(429, `${what} Vui lòng thử lại sau ít phút.`);
  /** Bật mặc định. Tắt ở Cấu hình website > Bảo mật. */
  const protectsLiving = (s: Record<string, string>) => s.protect_living !== '0';

  const MAX_FEATURED = 5;
  async function featuredIds(c: C): Promise<number[]> {
    const row = await db(c).first<{ value: string }>("SELECT value FROM settings WHERE key = 'featured_articles'");
    try {
      const v = JSON.parse(row?.value || '[]');
      return Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_FEATURED) : [];
    } catch { return []; }
  }

  async function canView(c: C) {
    if (await isAdmin(c)) return true;
    const s = await settingsMap(c);
    if (!s.viewer_passcode_hash) return true; // chưa đặt mã: phả đồ công khai
    const p = await verifyToken(getCookie(c, VIEW_COOKIE), c.get('deps').secret);
    return p?.role === 'viewer' && p.v === s.viewer_passcode_hash.slice(-12);
  }

  const requireViewer = async (c: C, next: () => Promise<void>) => {
    if (!(await canView(c))) return c.json({ error: 'Cần nhập mã bảo mật để xem phả đồ.', locked: true }, 401);
    await next();
  };

  // ---------- Public ----------
  // Chính sách bảo mật do quản trị viên soạn. Rỗng thì trang xem dùng bản mặc định.
  app.get('/privacy', async (c) => {
    const row = await db(c).first<{ value: string }>("SELECT value FROM settings WHERE key = 'privacy'");
    return c.json({ html: row?.value ?? '' });
  });
  app.get('/site', async (c) => {
    const s = await settingsMap(c);
    const categories = await db(c).all('SELECT id, slug, name FROM categories ORDER BY sort, id');
    const pub = Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, s[k] ?? '']));
    return c.json({
      ...pub,
      menu: menuLinks(parseMenu(s.menu), new Set(categories.map((x: any) => x.slug))),
      locked: !!s.viewer_passcode_hash,
      unlocked: await canView(c),
      categories,
      ...Object.fromEntries(FILE_SETTINGS.map((k) => [k, s[k] ? Number(s[k]) : null])),
    });
  });

  app.post('/viewer/unlock', async (c) => {
    const { passcode } = await c.req.json<{ passcode: string }>().catch(() => ({ passcode: '' }));
    const s = await settingsMap(c);
    const key = await ipKey(c, 'unlock');
    if (!(await allowed(db(c), key, LIMITS.unlockIp)) || !(await allowed(db(c), 'unlock:all', LIMITS.unlockAll)))
      throw tooMany('Bạn đã nhập sai mã quá nhiều lần.');
    await new Promise((r) => setTimeout(r, 300)); // làm chậm thử mã
    if (!s.viewer_passcode_hash || !(await verifyPassword(String(passcode ?? ''), s.viewer_passcode_hash))) {
      await hit(db(c), key, LIMITS.unlockIp);
      await hit(db(c), 'unlock:all', LIMITS.unlockAll);
      throw bad('Mã bảo mật không đúng.');
    }
    await clearLimit(db(c), key);
    const token = await signToken(
      { sub: 'viewer', role: 'viewer', exp: Date.now() + 30 * DAY, v: s.viewer_passcode_hash.slice(-12) },
      c.get('deps').secret,
    );
    setCookie(c, VIEW_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: secure(c), path: '/', maxAge: 30 * 86400 });
    return c.json({ ok: true });
  });

  app.post('/viewer/lock', (c) => {
    deleteCookie(c, VIEW_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  // Hòm thư: người xem gửi lời nhắn cho ban liên lạc
  app.post('/messages', async (c) => {
    const b = await c.req.json<any>().catch(() => ({}));
    if (b.website) return c.json({ ok: true }); // ô bẫy dành cho máy tự động điền
    if ((await settingsMap(c)).contact_form === '0') throw new HttpError(403, 'Trang này hiện không nhận lời nhắn.');
    const name = String(b.name ?? '').trim().slice(0, 80);
    const contact = String(b.contact ?? '').trim().slice(0, 120);
    const subject = String(b.subject ?? '').trim().slice(0, 120);
    const body = String(b.body ?? '').trim();
    if (name.length < 2) throw bad('Cần nhập họ tên.');
    if (body.length < 10) throw bad('Nội dung cần ít nhất 10 ký tự.');
    if (body.length > 3000) throw bad('Nội dung tối đa 3000 ký tự.');
    // Giới hạn theo từng người gửi trước, để một người gửi dồn dập không chặn luôn những người khác
    if (!(await hit(db(c), await ipKey(c, 'msg'), LIMITS.messageIp))) throw tooMany('Bạn đã gửi nhiều thư liên tiếp.');
    const recent = await db(c).first<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE created_at > datetime('now', '-10 minutes')");
    if ((recent?.n ?? 0) >= 30) throw tooMany('Hòm thư đang nhận quá nhiều thư.');
    await db(c).run('INSERT INTO messages (name, contact, subject, body) VALUES (?, ?, ?, ?)', [name, contact, subject, body]);
    return c.json({ ok: true });
  });

  app.get('/articles', async (c) => {
    const cat = c.req.query('category');
    const limit = intParam(c.req.query('limit'), 50, 200);
    const rows = await db(c).all(
      `SELECT a.id, a.slug, a.title, a.summary, a.cover_file_id, a.created_at, c.slug AS category_slug, c.name AS category_name
       FROM articles a LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.published = 1 ${cat ? 'AND c.slug = ?' : ''}
       ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
      cat ? [cat] : [],
    );
    return c.json(rows);
  });

  // Bài viết nổi bật: tối đa 5 bài do quản trị viên chọn, lưu thứ tự trong settings. Chỉ trả bài đang đăng.
  app.get('/articles/featured', async (c) => {
    const ids = await featuredIds(c);
    if (!ids.length) return c.json([]);
    const rows = await db(c).all<any>(
      `SELECT a.id, a.slug, a.title, a.summary, a.cover_file_id, a.created_at, c.slug AS category_slug, c.name AS category_name
       FROM articles a LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.published = 1 AND a.id IN (${ids.map(() => '?').join(',')})`, ids);
    return c.json(ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean));
  });
  app.get('/articles/:slug', async (c) => {
    const admin = await isAdmin(c);
    const row = await db(c).first(
      `SELECT a.*, c.slug AS category_slug, c.name AS category_name
       FROM articles a LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.slug = ? ${admin ? '' : 'AND a.published = 1'}`,
      [c.req.param('slug')],
    );
    if (!row) throw new HttpError(404, 'Không tìm thấy bài viết.');
    return c.json(row);
  });

  app.get('/events/upcoming', async (c) => {
    const days = intParam(c.req.query('days'), 365, 800);
    const today = startOfDay(new Date());
    const until = new Date(today.getTime() + days * DAY);
    const out: any[] = [];
    const events = await db(c).all<any>('SELECT * FROM events');
    for (const e of events) {
      let date: Date | null = null;
      if (e.calendar === 'lunar') date = e.recurring || !e.year ? nextSolarOfLunar(e.day, e.month, today) : null;
      else if (e.recurring || !e.year) {
        date = new Date(today.getFullYear(), e.month - 1, e.day);
        if (date < today) date = new Date(today.getFullYear() + 1, e.month - 1, e.day);
      } else date = new Date(e.year, e.month - 1, e.day);
      if (e.calendar === 'lunar' && e.year && !e.recurring) {
        const s = lunarToSolar(e.day, e.month, e.year);
        date = s ? new Date(s[2], s[1] - 1, s[0]) : null;
      }
      if (date && date >= today && date <= until) out.push({ ...e, kind: 'event', next_date: ymd(date) });
    }
    // Ngày giỗ chỉ hiện khi người xem đã mở khóa
    if (await canView(c)) {
      const dead = await db(c).all<any>(
        `SELECT id, full_name, generation, death_lunar_day, death_lunar_month FROM members
         WHERE is_deceased = 1 AND death_lunar_day IS NOT NULL AND death_lunar_month IS NOT NULL
           ${(await isAdmin(c)) ? '' : 'AND is_hidden = 0'}`,
      );
      for (const m of dead) {
        const d = nextSolarOfLunar(m.death_lunar_day, m.death_lunar_month, today);
        if (d && d <= until)
          out.push({
            kind: 'gio',
            id: `m${m.id}`,
            member_id: m.id,
            title: `Giỗ ${m.full_name}`,
            description: m.generation ? `Đời thứ ${m.generation}` : '',
            calendar: 'lunar',
            day: m.death_lunar_day,
            month: m.death_lunar_month,
            next_date: ymd(d),
          });
      }
    }
    out.sort((a, b) => a.next_date.localeCompare(b.next_date));
    return c.json(out);
  });

  app.get('/albums', async (c) => {
    return c.json(
      await db(c).all(
        `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count,
         COALESCE(a.cover_file_id, (SELECT file_id FROM photos p WHERE p.album_id = a.id ORDER BY sort, id LIMIT 1)) AS cover
         FROM albums a ORDER BY a.created_at DESC`,
      ),
    );
  });

  app.get('/albums/:id', async (c) => {
    const album = await db(c).first('SELECT * FROM albums WHERE id = ?', [c.req.param('id')]);
    if (!album) throw new HttpError(404, 'Không tìm thấy album.');
    const photos = await db(c).all('SELECT * FROM photos WHERE album_id = ? ORDER BY sort, id', [album.id]);
    return c.json({ ...album, photos });
  });

  app.get('/files/:id', async (c) => {
    const f = await db(c).first<any>('SELECT * FROM files WHERE id = ?', [c.req.param('id')]);
    if (!f) throw new HttpError(404, 'Không có file.');
    const isMemberPhoto = await db(c).first('SELECT 1 FROM members WHERE photo_file_id = ? LIMIT 1', [f.id]);
    if (isMemberPhoto && !(await canView(c))) throw new HttpError(401, 'Cần mã bảo mật.');
    const deps = c.get('deps');
    const store = f.storage === deps.storage.kind ? deps.storage : deps.readers?.[f.storage];
    if (!store) throw new HttpError(404, `File nằm ở storage "${f.storage}" nhưng storage này chưa được cấu hình.`);
    // File không bao giờ đổi nội dung (mỗi lần tải lên là một id mới), nên giữ bản sao ở cache của Cloudflare
    // để lần sau khỏi gọi sang Google Drive. Quyền xem đã được kiểm tra ở trên, trước khi đọc cache.
    // Cache API chỉ có tác dụng khi trang chạy trên tên miền riêng; trên *.workers.dev và trên Node thì bỏ qua.
    const edge = (globalThis as any).caches?.default as { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> } | undefined;
    const key = new Request(new URL(`/__file/${f.id}`, c.req.url).toString());
    // File cũ có loại không nằm trong danh sách an toàn thì trả về dạng tải xuống, không cho trình duyệt mở trực tiếp
    const safe = SAFE_MIME.includes(f.mime);
    const mime = safe ? f.mime : 'application/octet-stream';
    let body: any = edge ? (await edge.match(key).catch(() => undefined))?.body : undefined;
    if (!body) {
      const obj = await store.get(f.remote_id);
      if (!obj) throw new HttpError(404, 'File không còn trên storage.');
      body = obj.body;
      let ctx: { waitUntil(p: Promise<unknown>): void } | undefined;
      try { ctx = c.executionCtx; } catch { /* Node: không có executionCtx */ }
      if (edge && ctx) {
        const keep = new Response(obj.body as any, { headers: { 'content-type': mime, 'cache-control': 'public, max-age=2592000' } });
        ctx.waitUntil(edge.put(key, keep.clone()).catch(() => {}));
        body = keep.body;
      }
    }
    return new Response(body, {
      headers: {
        'content-type': mime,
        'cache-control': isMemberPhoto ? 'private, max-age=86400' : 'public, max-age=31536000, immutable',
        'content-disposition': `${safe ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        'x-robots-tag': 'noindex, noimageindex',
        ...FILE_HEADERS,
      },
    });
  });

  // ---------- Viewer (cần mã bảo mật) ----------
  app.get('/tree', requireViewer, async (c) => {
    const admin = await isAdmin(c);
    const members = await db(c).all<any>(
      `SELECT id, full_name, alias, gender, generation, father_id, mother_id, birth_order, is_blood, is_deceased,
              birth_date, death_date, branch, photo_file_id, is_hidden, title_role, child_type
       FROM members ${admin ? '' : 'WHERE is_hidden = 0'} ORDER BY generation, birth_order, id`,
    );
    const shown = new Set(members.map((m) => m.id));
    const marriages = (await db(c).all<any>('SELECT id, husband_id, wife_id, order_no FROM marriages ORDER BY order_no, id'))
      .filter((mr) => shown.has(mr.husband_id) && shown.has(mr.wife_id));
    const mask = !admin && protectsLiving(await settingsMap(c));
    return c.json({ members: mask ? members.map(maskLiving) : members, marriages });
  });

  app.get('/members/:id', requireViewer, async (c) => {
    const id = Number(c.req.param('id'));
    const admin = await isAdmin(c);
    // Người xem thường mở vài chục hồ sơ mỗi lần; máy quét thì mở hàng nghìn. Quản lý không bị giới hạn.
    if (!admin && !(await hit(db(c), await ipKey(c, 'profile'), LIMITS.profileIp))) throw tooMany('Bạn đang mở quá nhiều hồ sơ trong thời gian ngắn.');
    const m = await db(c).first<any>('SELECT * FROM members WHERE id = ?', [id]);
    if (!m || (m.is_hidden && !admin)) throw new HttpError(404, 'Không tìm thấy thành viên.');
    const vis = admin ? '' : ' AND is_hidden = 0';
    const brief = 'id, full_name, gender, generation, is_deceased, birth_date, death_date, photo_file_id, birth_order';
    const [father, mother, children, spouses] = await Promise.all([
      m.father_id ? db(c).first(`SELECT ${brief} FROM members WHERE id = ?${vis}`, [m.father_id]) : null,
      m.mother_id ? db(c).first(`SELECT ${brief} FROM members WHERE id = ?${vis}`, [m.mother_id]) : null,
      db(c).all(`SELECT ${brief} FROM members WHERE (father_id = ? OR mother_id = ?)${vis} ORDER BY birth_order, birth_date, id`, [id, id]),
      db(c).all(
        `SELECT ${brief.split(', ').map((f) => 'm.' + f).join(', ')}, mr.order_no, mr.id AS marriage_id FROM marriages mr
         JOIN members m ON m.id = CASE WHEN mr.husband_id = ? THEN mr.wife_id ELSE mr.husband_id END
         WHERE (mr.husband_id = ? OR mr.wife_id = ?)${admin ? '' : ' AND m.is_hidden = 0'} ORDER BY mr.order_no`,
        [id, id, id],
      ),
    ]);
    if (admin || !protectsLiving(await settingsMap(c))) return c.json({ ...m, father, mother, children, spouses });
    return c.json({
      ...maskLiving(m), father: father && maskLiving(father), mother: mother && maskLiving(mother),
      children: children.map(maskLiving), spouses: spouses.map(maskLiving),
    });
  });

  app.get('/kinship', requireViewer, async (c) => {
    const a = Number(c.req.query('a'));
    const b = Number(c.req.query('b'));
    if (!a || !b) throw bad('Chọn hai thành viên.');
    const members = await db(c).all<any>('SELECT id, full_name, gender, father_id, mother_id, birth_order, birth_date FROM members');
    const marriages = await db(c).all<any>('SELECT husband_id, wife_id FROM marriages');
    const ctx = buildCtx(members, marriages);
    return c.json({ a_calls_b: kinship(ctx, a, b), b_calls_a: kinship(ctx, b, a) });
  });

  // Tải cả danh sách về một file. Khi phả đồ để công khai (chưa đặt mã xem) thì chỉ quản lý mới tải được,
  // vì đây là cách nhanh nhất để người lạ lấy toàn bộ dữ liệu của họ.
  app.get('/export/members.csv', requireViewer, async (c) => {
    const admin = await isAdmin(c);
    const st = await settingsMap(c);
    if (!admin) {
      if (!st.viewer_passcode_hash) throw new HttpError(403, 'Chỉ người quản lý mới tải được danh sách khi phả đồ để công khai.');
      if (!(await hit(db(c), await ipKey(c, 'export'), LIMITS.exportIp))) throw tooMany('Bạn đã tải danh sách nhiều lần.');
    }
    const mask = !admin && protectsLiving(st);
    const rows = (await db(c).all<any>(
      `SELECT m.id, m.generation, m.full_name, m.alias, m.gender, f.full_name AS father, mo.full_name AS mother,
              m.birth_order, m.birth_date, m.death_date, m.death_lunar_day, m.death_lunar_month, m.is_deceased,
              m.is_blood, m.branch, m.hometown, m.burial_place
       FROM members m LEFT JOIN members f ON f.id = m.father_id LEFT JOIN members mo ON mo.id = m.mother_id
       ${admin ? '' : 'WHERE m.is_hidden = 0'} ORDER BY m.generation, m.id`,
    )).map((r) => (mask ? maskLiving(r) : r));
    const head = ['ID', 'Đời', 'Họ tên', 'Tên khác', 'Giới tính', 'Cha', 'Mẹ', 'Thứ', 'Ngày sinh', 'Ngày mất',
      'Giỗ (âm)', 'Đã mất', 'Huyết thống', 'Chi', 'Quê quán', 'Nơi an táng'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [r.id, r.generation, r.full_name, r.alias, r.gender === 'male' ? 'Nam' : 'Nữ', r.father, r.mother, r.birth_order,
        r.birth_date, r.death_date, r.death_lunar_day ? `${r.death_lunar_day}/${r.death_lunar_month}` : '',
        r.is_deceased ? 'Có' : '', r.is_blood ? 'Có' : 'Dâu/rể', r.branch, r.hometown, r.burial_place].map(esc).join(','),
    );
    return new Response('﻿' + [head.join(','), ...lines].join('\r\n'), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="gia-pha.csv"' },
    });
  });

  // ---------- Admin ----------
  app.post('/admin/login', async (c) => {
    const { username, password } = await c.req.json<{ username: string; password: string }>().catch(() => ({ username: '', password: '' }));
    const name = String(username ?? '').trim().slice(0, 64);
    const userKey = `login:u:${await fingerprint(c.get('deps').secret, name.toLowerCase())}`;
    const ipK = await ipKey(c, 'login');
    const userIpKey = `${userKey}:${ipK}`;
    if (!(await allowed(db(c), userIpKey, LIMITS.loginUserIp)) || !(await allowed(db(c), userKey, LIMITS.loginUser)) || !(await allowed(db(c), ipK, LIMITS.loginIp)))
      throw tooMany('Đăng nhập sai quá nhiều lần.');
    await new Promise((r) => setTimeout(r, 300));
    const u = await db(c).first<any>('SELECT * FROM admins WHERE username = ?', [name]);
    // Tên không tồn tại vẫn chạy phép băm, để thời gian trả lời không tiết lộ tên nào có thật
    const ok = await verifyPassword(String(password ?? ''), u?.password_hash ?? DUMMY_HASH);
    if (!u || !ok) {
      await hit(db(c), userIpKey, LIMITS.loginUserIp);
      await hit(db(c), userKey, LIMITS.loginUser);
      await hit(db(c), ipK, LIMITS.loginIp);
      throw bad('Sai tên đăng nhập hoặc mật khẩu.');
    }
    await clearLimit(db(c), userIpKey);
    await db(c).run("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?", [u.id]);
    await issueAdminCookie(c, u.id, u.password_hash);
    return c.json({ id: u.id, username: u.username, display_name: u.display_name, role: u.role === 'editor' ? 'editor' : 'admin' });
  });

  app.post('/admin/logout', (c) => {
    deleteCookie(c, ADMIN_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  // Lần đầu: chưa có admin nào thì cho tạo tài khoản đầu tiên
  app.get('/admin/setup', async (c) => {
    const n = await db(c).first<{ n: number }>('SELECT COUNT(*) AS n FROM admins');
    return c.json({ needsSetup: !n?.n });
  });
  app.post('/admin/setup', async (c) => {
    const n = await db(c).first<{ n: number }>('SELECT COUNT(*) AS n FROM admins');
    if (n?.n) throw new HttpError(403, 'Đã có tài khoản quản trị.');
    const { username, password, display_name } = await c.req.json<any>();
    if (!username || String(password ?? '').length < 8) throw bad('Tên đăng nhập bắt buộc, mật khẩu tối thiểu 8 ký tự.');
    await db(c).run('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)', [
      String(username).trim(), await hashPassword(password), display_name || username,
    ]);
    return c.json({ ok: true });
  });

  app.use('/admin/*', async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path.endsWith('/admin/login') || path.endsWith('/admin/setup')) return next();
    const id = await isAdmin(c);
    if (!id) return c.json({ error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' }, 401);
    c.set('adminId', id);
    const method = c.req.method;
    const seg = path.split('/admin/')[1]?.split('/') ?? [];
    // Vai trò đọc từ database mỗi lần gọi: đổi quyền hoặc xóa tài khoản có hiệu lực ngay
    let role: Role = 'admin';
    let branch: string | null = null;
    let who: any = null;
    try {
      who = await db(c).first<any>('SELECT role, branch, display_name, username FROM admins WHERE id = ?', [id]);
      role = who?.role === 'editor' ? 'editor' : 'admin';
      branch = role === 'editor' ? String(who?.branch ?? '').trim() || null : null;
    } catch {
      who = await db(c).first<any>('SELECT display_name, username FROM admins WHERE id = ?', [id]); // chưa chạy migration 0004
    }
    if (!who) return c.json({ error: 'Tài khoản không còn tồn tại.' }, 401);
    c.set('role', role);
    c.set('branch', branch);
    if (role === 'editor') {
      const ownName = seg[0] === 'admins' && Number(seg[1]) === id && !seg[2] && method === 'PUT';
      const readCats = seg[0] === 'categories' && method === 'GET';
      const bulk = (seg[0] === 'members' || seg[0] === 'marriages') && (seg[1] === 'import' || seg[1] === 'export');
      if ((ADMIN_ONLY.includes(seg[0]) && !ownName && !readCats) || bulk)
        return c.json({ error: 'Tài khoản biên tập viên không có quyền với mục này.' }, 403);
    }
    if (method === 'GET') return next();
    // Nhật ký: ghi sau khi thao tác thành công. Lỗi ghi nhật ký không được làm hỏng thao tác chính.
    let res = LOG_RES[seg[0]];
    if (res?.only && !res.only.includes(method)) res = undefined as any;
    let custom = '';
    let name = '';
    try {
      if (res && c.req.header('content-type')?.includes('json')) {
        const b = await c.req.json<any>().catch(() => ({}));
        name = b?.full_name ?? b?.title ?? b?.name ?? b?.username ?? '';
        if (seg[1] === 'import') custom = seg[0] === 'members' ? `Nhập từ file: ${b?.rows?.length ?? 0} thành viên` : `Nhập từ file: ${b?.pairs?.length ?? 0} quan hệ hôn nhân`;
      }
      // Sửa hoặc xóa theo id: lấy tên đang lưu để nhật ký đọc được
      if (res && !name && res.table && /^\d+$/.test(seg[1] ?? ''))
        name = (await db(c).first<any>(`SELECT ${res.col} AS n FROM ${res.table} WHERE id = ?`, [Number(seg[1])]))?.n ?? '';
    } catch { /* bỏ qua */ }
    await next();
    if (!res || c.res.status >= 400) return;
    try {
      const verb = seg[2] === 'password' || seg[0] === 'password' ? 'Đổi mật khẩu' : method === 'POST' ? 'Thêm' : method === 'DELETE' ? 'Xóa' : 'Sửa';
      await db(c).run('INSERT INTO audit_logs (admin_id, admin_name, action) VALUES (?, ?, ?)', [
        id, who?.display_name || who?.username || '', custom || `${verb} ${res.label}${name ? ': ' + String(name).slice(0, 120) : ''}`,
      ]);
    } catch { /* bảng chưa có hoặc lỗi ghi: bỏ qua */ }
  });

  app.get('/admin/logs', async (c) => {
    const limit = intParam(c.req.query('limit'), 50, 200);
    const offset = intParam(c.req.query('offset'), 0, 1_000_000);
    try {
      const rows = await db(c).all('SELECT id, admin_name, action, created_at FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
      const total = (await db(c).first<{ n: number }>('SELECT COUNT(*) AS n FROM audit_logs'))?.n ?? 0;
      return c.json({ rows, total });
    } catch {
      return c.json({ rows: [], total: 0 });
    }
  });

  app.get('/admin/me', async (c) => {
    const me = await db(c).first<any>('SELECT id, username, display_name FROM admins WHERE id = ?', [c.get('adminId')]);
    return c.json({ ...me, role: c.get('role') ?? 'admin', branch: c.get('branch') ?? null });
  });

  app.get('/admin/stats', async (c) => {
    const q = (sql: string) => db(c).first<{ n: number }>(sql).then((r) => r?.n ?? 0);
    const [members, living, deceased, generations, articles, events, albums, photos] = await Promise.all([
      q('SELECT COUNT(*) AS n FROM members'),
      q('SELECT COUNT(*) AS n FROM members WHERE is_deceased = 0'),
      q('SELECT COUNT(*) AS n FROM members WHERE is_deceased = 1'),
      q('SELECT MAX(generation) AS n FROM members'),
      q('SELECT COUNT(*) AS n FROM articles'),
      q('SELECT COUNT(*) AS n FROM events'),
      q('SELECT COUNT(*) AS n FROM albums'),
      q('SELECT COUNT(*) AS n FROM photos'),
    ]);
    const missing = await db(c).all(
      `SELECT id, full_name, generation FROM members WHERE is_blood = 1 AND father_id IS NULL AND mother_id IS NULL
       AND generation > 1 ORDER BY generation LIMIT 20`,
    );
    const safe = (sql: string) => q(sql).catch(() => 0); // bảng hoặc cột mới có thể chưa có
    const [unread, pending] = await Promise.all([
      safe('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0'),
      safe('SELECT COUNT(*) AS n FROM articles WHERE published = 2'),
    ]);
    return c.json({ members, living, deceased, generations, articles, events, albums, photos, orphans: missing,
      unread, pending, storage: c.get('deps').storage.kind });
  });

  // Members
  app.get('/admin/members', async (c) => {
    return c.json(
      await db(c).all(
        `SELECT m.id, m.full_name, m.alias, m.gender, m.generation, m.father_id, m.mother_id, m.birth_order, m.is_blood,
                m.is_deceased, m.birth_date, m.death_date, m.branch, m.photo_file_id, m.updated_at, m.is_hidden, m.title_role, m.child_type,
                f.full_name AS father_name, mo.full_name AS mother_name
         FROM members m LEFT JOIN members f ON f.id = m.father_id LEFT JOIN members mo ON mo.id = m.mother_id
         ORDER BY m.generation, m.birth_order, m.id`,
      ),
    );
  });

  // Xuất toàn bộ để tạo file Excel ở trình duyệt
  app.get('/admin/members/export', async (c) => {
    const members = await db(c).all('SELECT * FROM members ORDER BY generation, birth_order, id');
    const marriages = await db(c).all('SELECT husband_id, wife_id, order_no FROM marriages ORDER BY order_no, id');
    return c.json({ members, marriages });
  });

  // Nhập từ file: trình duyệt gửi từng lô nhỏ, cha mẹ đứng trước con. ref là mã trong file, known là mã đã có id thật.
  app.post('/admin/members/import', async (c) => {
    const b = await c.req.json<{ rows: any[]; known?: Record<string, number> }>();
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length || rows.length > IMPORT_MAX) throw bad(`Mỗi lô từ 1 đến ${IMPORT_MAX} dòng.`);
    const ids: Record<string, number> = {};
    const resolve = (ref: unknown) => {
      if (ref == null || ref === '') return null;
      const id = ids[String(ref)] ?? b.known?.[String(ref)];
      if (!id) throw bad(`Không tìm thấy cha hoặc mẹ có mã "${ref}". Cha mẹ phải được nhập trước con.`);
      return Number(id);
    };
    for (const r of rows) {
      if (!String(r.full_name ?? '').trim()) throw bad('Có dòng thiếu họ tên.');
      if (!['male', 'female'].includes(r.gender)) throw bad(`Giới tính của "${r.full_name}" không hợp lệ.`);
    }
    for (const r of rows) {
      const m = normMember({
        ...r, full_name: String(r.full_name).trim(), photo_file_id: Number(r.photo_file_id) > 0 ? Number(r.photo_file_id) : null,
        father_id: resolve(r.father_ref), mother_id: resolve(r.mother_ref),
        generation: Number(r.generation) > 0 ? Math.floor(Number(r.generation)) : 1,
        is_blood: r.is_blood === 0 || r.is_blood === false ? 0 : 1,
        is_deceased: r.is_deceased ? 1 : 0,
      });
      const res = await db(c).run(
        `INSERT INTO members (${MEMBER_FIELDS.join(', ')}) VALUES (${MEMBER_FIELDS.map(() => '?').join(', ')})`, pick(m));
      ids[String(r.ref)] = res.lastId;
    }
    return c.json({ ids });
  });

  app.post('/admin/marriages/import', async (c) => {
    const b = await c.req.json<{ pairs: { a: number; b: number; order_no?: number }[] }>();
    const pairs = Array.isArray(b.pairs) ? b.pairs : [];
    if (!pairs.length || pairs.length > IMPORT_MAX) throw bad(`Mỗi lô từ 1 đến ${IMPORT_MAX} cặp.`);
    const all = [...new Set(pairs.flatMap((p) => [Number(p.a), Number(p.b)]))];
    const g = new Map((await db(c).all<any>(`SELECT id, gender FROM members WHERE id IN (${all.map(() => '?').join(', ')})`, all)).map((m) => [m.id, m.gender]));
    let added = 0;
    for (const p of pairs) {
      const h = g.get(Number(p.a)) === 'male' ? Number(p.a) : Number(p.b);
      const w = h === Number(p.a) ? Number(p.b) : Number(p.a);
      if (g.get(h) !== 'male' || g.get(w) !== 'female') continue;
      const r = await db(c).run('INSERT OR IGNORE INTO marriages (husband_id, wife_id, order_no) VALUES (?, ?, ?)', [h, w, Number(p.order_no) || 1]);
      added += r.changes;
    }
    return c.json({ added });
  });

  app.get('/admin/members/:id', async (c) => {
    const m = await db(c).first('SELECT * FROM members WHERE id = ?', [c.req.param('id')]);
    if (!m) throw new HttpError(404, 'Không tìm thấy.');
    const marriages = await db(c).all(
      `SELECT mr.*, h.full_name AS husband_name, w.full_name AS wife_name FROM marriages mr
       JOIN members h ON h.id = mr.husband_id JOIN members w ON w.id = mr.wife_id
       WHERE mr.husband_id = ? OR mr.wife_id = ? ORDER BY mr.order_no`,
      [m.id, m.id],
    );
    return c.json({ ...m, marriages });
  });

  async function validateMember(c: C, body: any, selfId?: number) {
    if (!String(body.full_name ?? '').trim()) throw bad('Họ tên là bắt buộc.');
    if (!['male', 'female'].includes(body.gender)) throw bad('Giới tính không hợp lệ.');
    for (const [k, g] of [['father_id', 'male'], ['mother_id', 'female']] as const) {
      if (!body[k]) continue;
      const p = await db(c).first<any>('SELECT id, gender FROM members WHERE id = ?', [body[k]]);
      if (!p) throw bad(`${k === 'father_id' ? 'Cha' : 'Mẹ'} không tồn tại.`);
      if (p.gender !== g) throw bad(`${k === 'father_id' ? 'Cha' : 'Mẹ'} phải là ${g === 'male' ? 'nam' : 'nữ'}.`);
      if (selfId && (p.id === selfId || (await isDescendant(c, p.id, selfId))))
        throw bad('Không thể chọn chính mình hoặc con cháu của mình làm cha/mẹ.');
    }
    const d = body.death_lunar_day;
    const mth = body.death_lunar_month;
    if ((d && !mth) || (!d && mth)) throw bad('Ngày giỗ cần đủ ngày và tháng âm lịch.');
    if (d && (d < 1 || d > 30 || mth < 1 || mth > 12)) throw bad('Ngày giỗ âm lịch không hợp lệ.');
  }

  async function isDescendant(c: C, candidate: number, ancestor: number) {
    const all = await db(c).all<any>('SELECT id, father_id, mother_id FROM members');
    const byId = new Map(all.map((m) => [m.id, m]));
    const stack = [candidate];
    const seen = new Set<number>();
    while (stack.length) {
      const cur = byId.get(stack.pop()!);
      if (!cur || seen.has(cur.id)) continue;
      seen.add(cur.id);
      for (const p of [cur.father_id, cur.mother_id]) {
        if (p === ancestor) return true;
        if (p) stack.push(p);
      }
    }
    return false;
  }

  const pick = (body: any) => MEMBER_FIELDS.map((f) => (f in body ? body[f] : null));

  /** Biên tập viên bị giới hạn theo chi chỉ được sửa người thuộc chi đó. */
  async function assertBranch(c: C, memberIds: number[]) {
    const br = c.get('branch');
    if (!br) return;
    const ids = memberIds.filter(Boolean);
    const rows = ids.length
      ? await db(c).all<any>(`SELECT branch FROM members WHERE id IN (${ids.map(() => '?').join(', ')})`, ids)
      : [];
    if (!rows.some((r) => String(r.branch ?? '').trim() === br))
      throw new HttpError(403, `Tài khoản của bạn chỉ được sửa thành viên thuộc chi "${br}".`);
  }

  app.post('/admin/members', async (c) => {
    const body = await c.req.json<any>();
    if (c.get('branch')) body.branch = c.get('branch'); // người do biên tập chi thêm luôn thuộc chi đó
    await validateMember(c, body);
    const r = await db(c).run(
      `INSERT INTO members (${MEMBER_FIELDS.join(', ')}) VALUES (${MEMBER_FIELDS.map(() => '?').join(', ')})`,
      pick(normMember({ is_blood: 1, is_deceased: 0, ...body, full_name: body.full_name.trim() })),
    );
    if (body.spouse_id) await addMarriage(c, r.lastId, Number(body.spouse_id), 1);
    await recomputeGenerations(db(c));
    return c.json({ id: r.lastId });
  });

  app.put('/admin/members/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const existing = await db(c).first<any>('SELECT * FROM members WHERE id = ?', [id]);
    if (!existing) throw new HttpError(404, 'Không tìm thấy.');
    await assertBranch(c, [id]);
    // Trường không gửi lên thì giữ nguyên giá trị cũ
    const body = { ...existing, ...(await c.req.json<any>()) };
    if (c.get('branch')) body.branch = c.get('branch');
    await validateMember(c, body, id);
    await db(c).run(
      `UPDATE members SET ${MEMBER_FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      [...pick(normMember({ ...body, full_name: body.full_name.trim() })), id],
    );
    await recomputeGenerations(db(c));
    return c.json({ ok: true });
  });

  app.delete('/admin/members/:id', async (c) => {
    const id = Number(c.req.param('id'));
    await assertBranch(c, [id]);
    const kids = await db(c).first<{ n: number }>('SELECT COUNT(*) AS n FROM members WHERE father_id = ? OR mother_id = ?', [id, id]);
    if (kids?.n && c.req.query('force') !== '1')
      throw bad(`Thành viên này có ${kids.n} người con. Gỡ liên kết con trước hoặc xác nhận xóa.`);
    await db(c).run('DELETE FROM marriages WHERE husband_id = ? OR wife_id = ?', [id, id]);
    await db(c).run('UPDATE members SET father_id = NULL WHERE father_id = ?', [id]);
    await db(c).run('UPDATE members SET mother_id = NULL WHERE mother_id = ?', [id]);
    await db(c).run('DELETE FROM members WHERE id = ?', [id]);
    await recomputeGenerations(db(c));
    return c.json({ ok: true });
  });

  async function addMarriage(c: C, a: number, b: number, order: number, note?: string) {
    const ms = await db(c).all<any>('SELECT id, gender FROM members WHERE id IN (?, ?)', [a, b]);
    if (ms.length !== 2) throw bad('Thành viên không tồn tại.');
    const h = ms.find((m) => m.gender === 'male');
    const w = ms.find((m) => m.gender === 'female');
    if (!h || !w) throw bad('Hôn nhân cần một nam và một nữ trong dữ liệu hiện tại.');
    return db(c).run('INSERT OR IGNORE INTO marriages (husband_id, wife_id, order_no, note) VALUES (?, ?, ?, ?)', [
      h.id, w.id, order || 1, note,
    ]);
  }

  app.post('/admin/marriages', async (c) => {
    const b = await c.req.json<any>();
    await assertBranch(c, [Number(b.a), Number(b.b)]);
    const r = await addMarriage(c, Number(b.a), Number(b.b), Number(b.order_no) || 1, b.note);
    await recomputeGenerations(db(c));
    return c.json({ id: r.lastId });
  });
  const marriageMembers = async (c: C) => {
    const mr = await db(c).first<any>('SELECT husband_id, wife_id FROM marriages WHERE id = ?', [c.req.param('id')]);
    return mr ? [mr.husband_id, mr.wife_id] : [];
  };
  app.put('/admin/marriages/:id', async (c) => {
    if (c.get('branch')) await assertBranch(c, await marriageMembers(c));
    const b = await c.req.json<any>();
    await db(c).run('UPDATE marriages SET order_no = ?, note = ? WHERE id = ?', [Number(b.order_no) || 1, b.note, c.req.param('id')]);
    return c.json({ ok: true });
  });
  app.delete('/admin/marriages/:id', async (c) => {
    if (c.get('branch')) await assertBranch(c, await marriageMembers(c));
    await db(c).run('DELETE FROM marriages WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  app.post('/admin/recompute-generations', async (c) => {
    return c.json({ updated: await recomputeGenerations(db(c)) });
  });

  // Upload
  app.post('/admin/upload', async (c) => {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw bad('Không có file.');
    if (file.size > MAX_UPLOAD) throw bad('File vượt quá 15 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Loại file lấy từ nội dung thật, không tin tên file hay phần khai của trình duyệt
    const mime = sniffUpload(bytes);
    if (!mime) throw bad('Chỉ nhận ảnh (JPG, PNG, WebP, GIF, AVIF, SVG) hoặc file PDF.');
    const name = file.name.replace(/[\\/\u0000-\u001f]/g, '').replace(/\.{2,}/g, '.').replace(/^\.+/, '').slice(0, 120) || 'file';
    const storage = c.get('deps').storage;
    const remote = await storage.put(name, mime, bytes);
    const r = await db(c).run('INSERT INTO files (storage, remote_id, name, mime, size) VALUES (?, ?, ?, ?, ?)', [
      storage.kind, remote, name, mime, file.size,
    ]);
    return c.json({ id: r.lastId, name });
  });

  // Chép một ảnh từ địa chỉ ngoài về kho lưu của trang. Dùng khi chuyển dữ liệu từ nơi khác sang.
  // Chỉ nhận https từ các máy chủ trong danh sách, để không biến máy chủ này thành công cụ gọi địa chỉ tùy ý.
  app.post('/admin/import-url', async (c) => {
    const b = await c.req.json<{ url?: string }>();
    let u: URL;
    try { u = new URL(String(b.url ?? '')); } catch { throw bad('Địa chỉ ảnh không hợp lệ.'); }
    if (u.protocol !== 'https:' || !IMPORT_HOSTS.includes(u.hostname)) throw bad('Chỉ nhận ảnh từ máy chủ được phép.');
    // Không đi theo chuyển hướng: nếu có, địa chỉ đích có thể nằm ngoài danh sách cho phép
    const res = await fetch(u.toString(), { redirect: 'manual' });
    if (res.status !== 200) throw bad(`Không tải được ảnh (mã ${res.status}).`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD) throw bad('Ảnh vượt quá 15 MB.');
    const mime = sniffUpload(bytes);
    if (!mime?.startsWith('image/')) throw bad('Địa chỉ này không phải ảnh.');
    const name = `${u.pathname.split('/').pop() || 'anh'}.${mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`;
    const storage = c.get('deps').storage;
    const remote = await storage.put(name, mime, bytes);
    const r = await db(c).run('INSERT INTO files (storage, remote_id, name, mime, size) VALUES (?, ?, ?, ?, ?)', [storage.kind, remote, name, mime, bytes.byteLength]);
    return c.json({ id: r.lastId, name, size: bytes.byteLength });
  });

  app.get('/admin/storage/check', async (c) => {
    try {
      return c.json({ ok: true, message: await c.get('deps').storage.check() });
    } catch (e: any) {
      return c.json({ ok: false, message: e.message });
    }
  });

  // Categories
  app.get('/admin/categories', async (c) => c.json(await db(c).all('SELECT * FROM categories ORDER BY sort, id')));
  app.post('/admin/categories', async (c) => {
    const b = await c.req.json<any>();
    if (!b.name?.trim()) throw bad('Tên chuyên mục bắt buộc.');
    const r = await db(c).run('INSERT INTO categories (slug, name, sort) VALUES (?, ?, ?)', [
      b.slug?.trim() || slugify(b.name), b.name.trim(), Number(b.sort) || 0,
    ]);
    return c.json({ id: r.lastId });
  });
  app.put('/admin/categories/:id', async (c) => {
    const b = await c.req.json<any>();
    await db(c).run('UPDATE categories SET slug = ?, name = ?, sort = ? WHERE id = ?', [
      b.slug?.trim() || slugify(b.name), b.name.trim(), Number(b.sort) || 0, c.req.param('id'),
    ]);
    return c.json({ ok: true });
  });
  app.delete('/admin/categories/:id', async (c) => {
    await db(c).run('DELETE FROM categories WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  // Articles
  app.get('/admin/articles', async (c) => {
    const rows = await db(c).all<any>(
      `SELECT a.id, a.slug, a.title, a.published, a.created_at, a.updated_at, a.author_name, c.name AS category_name
       FROM articles a LEFT JOIN categories c ON c.id = a.category_id ORDER BY a.published = 2 DESC, a.created_at DESC, a.id DESC`,
    );
    const feat = await featuredIds(c);
    // featured: vị trí trong danh sách nổi bật (1..5), 0 là không nổi bật. Bài đã gỡ đăng không còn tính.
    return c.json(rows.map((r) => ({ ...r, featured: r.published === 1 ? feat.indexOf(r.id) + 1 : 0 })));
  });
  // Chọn bài viết nổi bật cho trang chủ. Chỉ quản trị viên.
  app.put('/admin/featured', async (c) => {
    const b = await c.req.json<{ ids?: unknown }>();
    const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
    if (ids.length > MAX_FEATURED) throw bad(`Chỉ chọn được tối đa ${MAX_FEATURED} bài nổi bật. Hãy bỏ bớt một bài trước.`);
    if (ids.length) {
      const ok = await db(c).all<{ id: number }>(`SELECT id FROM articles WHERE published = 1 AND id IN (${ids.map(() => '?').join(',')})`, ids);
      if (ok.length !== ids.length) throw bad('Chỉ bài đã đăng mới đặt làm nổi bật được.');
    }
    await db(c).run("INSERT OR REPLACE INTO settings (key, value) VALUES ('featured_articles', ?)", [JSON.stringify(ids)]);
    return c.json({ ids });
  });
  app.get('/admin/articles/:id', async (c) => {
    const a = await db(c).first('SELECT * FROM articles WHERE id = ?', [c.req.param('id')]);
    if (!a) throw new HttpError(404, 'Không tìm thấy.');
    return c.json(a);
  });
  async function uniqueSlug(c: C, base: string, selfId?: number) {
    let slug = base || 'bai-viet';
    for (let i = 2; ; i++) {
      const hit = await db(c).first<any>('SELECT id FROM articles WHERE slug = ?', [slug]);
      if (!hit || hit.id === selfId) return slug;
      slug = `${base}-${i}`;
    }
  }
  // Trạng thái bài: 0 nháp, 1 đã đăng, 2 chờ duyệt. Biên tập viên không tự đăng được: bài chuyển sang chờ duyệt.
  const articleStatus = (c: C, v: unknown) => {
    const n = [0, 1, 2].includes(Number(v)) ? Number(v) : 1;
    return c.get('role') === 'editor' && n === 1 ? 2 : n;
  };
  app.post('/admin/articles', async (c) => {
    const b = await c.req.json<any>();
    if (!b.title?.trim()) throw bad('Tiêu đề bắt buộc.');
    const slug = await uniqueSlug(c, slugify(b.slug || b.title));
    const published = articleStatus(c, b.published);
    const r = await db(c).run(
      'INSERT INTO articles (category_id, slug, title, summary, content, cover_file_id, published) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [b.category_id, slug, b.title.trim(), b.summary, b.content, b.cover_file_id, published],
    );
    try {
      const who = await db(c).first<any>('SELECT display_name, username FROM admins WHERE id = ?', [c.get('adminId')]);
      await db(c).run('UPDATE articles SET author_name = ? WHERE id = ?', [who?.display_name || who?.username || '', r.lastId]);
    } catch { /* cột author_name chưa có */ }
    // Bài chuyển từ nơi khác sang: giữ ngày đăng gốc
    if (c.get('role') === 'admin' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(String(b.created_at ?? ''))) {
      const at = String(b.created_at).slice(0, 19).replace('T', ' ');
      await db(c).run('UPDATE articles SET created_at = ?, updated_at = ? WHERE id = ?', [at, at, r.lastId]);
    }
    if (b.author_name && c.get('role') === 'admin') await db(c).run('UPDATE articles SET author_name = ? WHERE id = ?', [String(b.author_name).slice(0, 80), r.lastId]);
    return c.json({ id: r.lastId, slug, published });
  });
  app.put('/admin/articles/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const b = await c.req.json<any>();
    if (!b.title?.trim()) throw bad('Tiêu đề bắt buộc.');
    const slug = await uniqueSlug(c, slugify(b.slug || b.title), id);
    const published = articleStatus(c, b.published);
    await db(c).run(
      `UPDATE articles SET category_id = ?, slug = ?, title = ?, summary = ?, content = ?, cover_file_id = ?, published = ?,
       updated_at = datetime('now') WHERE id = ?`,
      [b.category_id, slug, b.title.trim(), b.summary, b.content, b.cover_file_id, published, id],
    );
    return c.json({ ok: true, slug, published });
  });
  app.delete('/admin/articles/:id', async (c) => {
    if (c.get('role') === 'editor') {
      const a = await db(c).first<any>('SELECT published FROM articles WHERE id = ?', [c.req.param('id')]);
      if (a?.published === 1) throw new HttpError(403, 'Biên tập viên không xóa được bài đã đăng.');
    }
    await db(c).run('DELETE FROM articles WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  // Events
  app.get('/admin/events', async (c) => c.json(await db(c).all('SELECT * FROM events ORDER BY month, day')));
  const eventArgs = (b: any) => {
    if (!b.title?.trim()) throw bad('Tên sự kiện bắt buộc.');
    const d = Number(b.day);
    const m = Number(b.month);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) throw bad('Ngày tháng không hợp lệ.');
    return [b.title.trim(), b.description, b.calendar === 'lunar' ? 'lunar' : 'solar', d, m, b.year || null,
      b.recurring ?? 1, b.location];
  };
  app.post('/admin/events', async (c) => {
    const r = await db(c).run(
      'INSERT INTO events (title, description, calendar, day, month, year, recurring, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      eventArgs(await c.req.json()),
    );
    return c.json({ id: r.lastId });
  });
  app.put('/admin/events/:id', async (c) => {
    await db(c).run(
      'UPDATE events SET title = ?, description = ?, calendar = ?, day = ?, month = ?, year = ?, recurring = ?, location = ? WHERE id = ?',
      [...eventArgs(await c.req.json()), c.req.param('id')],
    );
    return c.json({ ok: true });
  });
  app.delete('/admin/events/:id', async (c) => {
    await db(c).run('DELETE FROM events WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  // Albums
  app.post('/admin/albums', async (c) => {
    const b = await c.req.json<any>();
    if (!b.title?.trim()) throw bad('Tên album bắt buộc.');
    const r = await db(c).run('INSERT INTO albums (title, description, cover_file_id) VALUES (?, ?, ?)', [
      b.title.trim(), b.description, b.cover_file_id,
    ]);
    return c.json({ id: r.lastId });
  });
  app.put('/admin/albums/:id', async (c) => {
    const b = await c.req.json<any>();
    await db(c).run('UPDATE albums SET title = ?, description = ?, cover_file_id = ? WHERE id = ?', [
      b.title?.trim(), b.description, b.cover_file_id, c.req.param('id'),
    ]);
    return c.json({ ok: true });
  });
  app.delete('/admin/albums/:id', async (c) => {
    await db(c).run('DELETE FROM photos WHERE album_id = ?', [c.req.param('id')]);
    await db(c).run('DELETE FROM albums WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });
  app.post('/admin/albums/:id/photos', async (c) => {
    const b = await c.req.json<{ file_ids: number[]; caption?: string }>();
    for (const fid of b.file_ids ?? [])
      await db(c).run('INSERT INTO photos (album_id, file_id, caption) VALUES (?, ?, ?)', [c.req.param('id'), fid, b.caption]);
    return c.json({ ok: true });
  });
  app.put('/admin/photos/:id', async (c) => {
    const b = await c.req.json<any>();
    await db(c).run('UPDATE photos SET caption = ? WHERE id = ?', [b.caption, c.req.param('id')]);
    return c.json({ ok: true });
  });
  app.delete('/admin/photos/:id', async (c) => {
    await db(c).run('DELETE FROM photos WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  // Settings
  app.get('/admin/settings', async (c) => {
    const s = await settingsMap(c);
    const { viewer_passcode_hash, ...rest } = s;
    return c.json({ ...rest, has_passcode: !!viewer_passcode_hash });
  });
  app.put('/admin/settings', async (c) => {
    const b = await c.req.json<Record<string, any>>();
    const keys = [...PUBLIC_SETTINGS, ...FILE_SETTINGS, 'privacy', 'protect_living'];
    if ('protect_living' in b) b.protect_living = b.protect_living === '0' || b.protect_living === 0 || b.protect_living === false ? '0' : '1';
    if ('privacy' in b && String(b.privacy ?? '').length > 60000) throw bad('Chính sách bảo mật quá dài.');
    if ('tree_lines' in b) b.tree_lines = ['curve', 'straight'].includes(b.tree_lines) ? b.tree_lines : 'ortho';
    if ('foreword' in b && String(b.foreword ?? '').length > 60000) throw bad('Lời nói đầu quá dài.');
    // Chuẩn hóa các trường có định dạng riêng trước khi lưu
    if ('template' in b) b.template = templateOf(b.template);
    if ('contact_people' in b) b.contact_people = JSON.stringify(parsePeople(b.contact_people));
    for (const k of ['contact_zalo', 'contact_facebook', 'contact_youtube', 'contact_tiktok']) {
      if (!(k in b)) continue;
      const raw = String(b[k] ?? '').trim();
      if (raw && !safeUrl(raw)) throw bad('Liên kết Zalo, Facebook, YouTube, TikTok phải bắt đầu bằng https://');
      b[k] = safeUrl(raw);
    }
    if ('contact_email' in b) {
      const e = String(b.contact_email ?? '').trim();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('Email liên hệ không đúng định dạng.');
      b.contact_email = e;
    }
    if ('contact_form' in b) b.contact_form = b.contact_form === '0' || b.contact_form === 0 || b.contact_form === false ? '0' : '1';
    for (const k of keys)
      if (k in b) await db(c).run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, String(b[k] ?? '')]);
    if ('passcode' in b) {
      const p = String(b.passcode ?? '');
      if (p && p.length < MIN_PASSCODE) throw bad(`Mã bảo mật tối thiểu ${MIN_PASSCODE} ký tự.`);
      await db(c).run("INSERT OR REPLACE INTO settings (key, value) VALUES ('viewer_passcode_hash', ?)", [
        p ? await hashPassword(p) : '',
      ]);
    }
    return c.json({ ok: true });
  });

  // Tên miền riêng. Trạng thái luôn hỏi trực tiếp Cloudflare; database chỉ nhớ tên miền và mã zone.
  const domainCtx = async (c: C) => {
    const cf = c.get('deps').cloudflare;
    const s = await settingsMap(c);
    return { cf, api: cf?.token ? cloudflareDomains(cf) : null, domain: s.domain_name || null, zoneId: s.domain_zone_id || null };
  };
  const domainGuard = async <T>(fn: () => Promise<T>) => {
    try { return await fn(); } catch (e) { if (e instanceof DomainError) throw new HttpError(502, e.message); throw e; }
  };
  app.get('/admin/domain', async (c) => {
    const { cf, api, domain, zoneId } = await domainCtx(c);
    const host = new URL(c.req.url).host;
    // supported: chạy trên Cloudflare. ready: đã có API token.
    if (!cf) return c.json({ supported: false, ready: false, host, stage: 'none', domain: null });
    if (!api) return c.json({ supported: true, ready: false, host, stage: 'none', domain });
    return c.json(await domainGuard(async () => {
      await api.verify();
      return { supported: true, ready: true, host, ...(await api.state(domain, zoneId)) };
    }));
  });
  app.post('/admin/domain', async (c) => {
    const { api, domain: current } = await domainCtx(c);
    if (!api) throw bad('Chưa khai API token của Cloudflare.');
    if (current) throw bad('Đã có một tên miền. Gỡ tên miền hiện tại trước khi thêm tên miền khác.');
    const domain = cleanDomain((await c.req.json<any>()).domain);
    if (!domain) throw bad('Tên miền chưa đúng. Nhập dạng hongo.vn, không dấu, không khoảng trắng.');
    const st = await domainGuard(() => api.add(domain));
    await db(c).run("INSERT OR REPLACE INTO settings (key, value) VALUES ('domain_name', ?)", [domain]);
    await db(c).run("INSERT OR REPLACE INTO settings (key, value) VALUES ('domain_zone_id', ?)", [st.zoneId]);
    return c.json({ supported: true, ready: true, host: new URL(c.req.url).host, ...st });
  });
  app.post('/admin/domain/check', async (c) => {
    const { api, domain, zoneId } = await domainCtx(c);
    if (!api || !domain || !zoneId) throw bad('Chưa có tên miền nào để kiểm tra.');
    return c.json({ supported: true, ready: true, host: new URL(c.req.url).host, ...(await domainGuard(() => api.check(domain, zoneId))) });
  });
  app.delete('/admin/domain', async (c) => {
    const { api, zoneId } = await domainCtx(c);
    if (api && zoneId) await domainGuard(() => api.remove(zoneId));
    await db(c).run("DELETE FROM settings WHERE key IN ('domain_name', 'domain_zone_id')");
    return c.json({ ok: true });
  });

  // Menu của trang xem
  app.get('/admin/menu', async (c) => {
    const s = await settingsMap(c);
    const categories = await db(c).all('SELECT slug, name FROM categories ORDER BY sort, id');
    return c.json({ items: parseMenu(s.menu), categories });
  });
  app.put('/admin/menu', async (c) => {
    const b = await c.req.json<any>();
    const items = parseMenu(b.items);
    if (!items.some((i) => i.visible)) throw bad('Menu cần ít nhất một mục đang hiện.');
    await db(c).run("INSERT OR REPLACE INTO settings (key, value) VALUES ('menu', ?)", [JSON.stringify(items)]);
    return c.json({ items });
  });

  // Hòm thư
  app.get('/admin/messages', async (c) => {
    const limit = intParam(c.req.query('limit'), 50, 200);
    const offset = intParam(c.req.query('offset'), 0, 1_000_000);
    const rows = await db(c).all('SELECT * FROM messages ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    const total = (await db(c).first<{ n: number }>('SELECT COUNT(*) AS n FROM messages'))?.n ?? 0;
    return c.json({ rows, total });
  });
  app.put('/admin/messages/:id', async (c) => {
    const b = await c.req.json<any>();
    await db(c).run('UPDATE messages SET is_read = ? WHERE id = ?', [b.is_read ? 1 : 0, c.req.param('id')]);
    return c.json({ ok: true });
  });
  app.delete('/admin/messages/:id', async (c) => {
    await db(c).run('DELETE FROM messages WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  // Tài khoản: quản trị viên (toàn quyền) và biên tập viên
  app.get('/admin/admins', async (c) =>
    c.json(await db(c).all('SELECT id, username, display_name, created_at, last_login_at, role, branch FROM admins ORDER BY id')),
  );
  const roleOf = (b: any): { role: Role; branch: string | null } => {
    const role: Role = b.role === 'editor' ? 'editor' : 'admin';
    return { role, branch: role === 'editor' ? String(b.branch ?? '').trim().slice(0, 60) || null : null };
  };
  const validUsername = (u: string) => /^[a-zA-Z0-9._-]{3,32}$/.test(u);
  app.post('/admin/admins', async (c) => {
    const b = await c.req.json<any>();
    const username = String(b.username ?? '').trim();
    if (!validUsername(username)) throw bad('Tên đăng nhập 3-32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.');
    if (String(b.password ?? '').length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự.');
    if (await db(c).first('SELECT 1 FROM admins WHERE username = ?', [username])) throw bad('Tên đăng nhập đã tồn tại.');
    const { role, branch } = roleOf(b);
    const r = await db(c).run('INSERT INTO admins (username, password_hash, display_name, role, branch) VALUES (?, ?, ?, ?, ?)', [
      username, await hashPassword(b.password), String(b.display_name ?? '').trim() || username, role, branch,
    ]);
    return c.json({ id: r.lastId });
  });
  app.put('/admin/admins/:id', async (c) => {
    const b = await c.req.json<any>();
    const name = String(b.display_name ?? '').trim();
    if (!name) throw bad('Tên hiển thị không được để trống.');
    const id = Number(c.req.param('id'));
    await db(c).run('UPDATE admins SET display_name = ? WHERE id = ?', [name, id]);
    if ('role' in b && c.get('role') === 'admin') {
      const { role, branch } = roleOf(b);
      if (role === 'editor') {
        if (id === c.get('adminId')) throw bad('Không thể tự hạ quyền của chính mình.');
        const n = await db(c).first<{ n: number }>("SELECT COUNT(*) AS n FROM admins WHERE role = 'admin' AND id <> ?", [id]);
        if (!n?.n) throw bad('Phải còn ít nhất một quản trị viên.');
      }
      await db(c).run('UPDATE admins SET role = ?, branch = ? WHERE id = ?', [role, branch, id]);
    }
    return c.json({ ok: true });
  });
  // Đặt lại mật khẩu cho người khác (không cần mật khẩu cũ)
  app.put('/admin/admins/:id/password', async (c) => {
    const id = Number(c.req.param('id'));
    if (id === c.get('adminId')) throw bad('Đổi mật khẩu của chính bạn ở mục Tài khoản của bạn.');
    const b = await c.req.json<any>();
    if (String(b.password ?? '').length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự.');
    await db(c).run('UPDATE admins SET password_hash = ? WHERE id = ?', [await hashPassword(b.password), id]);
    return c.json({ ok: true });
  });
  app.put('/admin/password', async (c) => {
    const b = await c.req.json<any>();
    const u = await db(c).first<any>('SELECT * FROM admins WHERE id = ?', [c.get('adminId')]);
    if (!(await verifyPassword(String(b.current ?? ''), u.password_hash))) throw bad('Mật khẩu hiện tại không đúng.');
    if (String(b.next ?? '').length < 8) throw bad('Mật khẩu mới tối thiểu 8 ký tự.');
    if (b.next === b.current) throw bad('Mật khẩu mới phải khác mật khẩu hiện tại.');
    const hash = await hashPassword(b.next);
    await db(c).run('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, u.id]);
    // Mọi phiên cũ của tài khoản này mất hiệu lực. Cấp phiên mới cho thiết bị đang dùng để không bị đăng xuất.
    await issueAdminCookie(c, u.id, hash);
    return c.json({ ok: true });
  });
  app.delete('/admin/admins/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (id === c.get('adminId')) throw bad('Không thể tự xóa tài khoản đang đăng nhập.');
    const n = await db(c).first<{ n: number }>("SELECT COUNT(*) AS n FROM admins WHERE role = 'admin' AND id <> ?", [id]);
    if (!n?.n) throw bad('Phải còn ít nhất một quản trị viên.');
    await db(c).run('DELETE FROM admins WHERE id = ?', [id]);
    return c.json({ ok: true });
  });

  return app;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Tính lại "đời" cho mọi thành viên: con = đời cha/mẹ + 1; dâu/rể = đời của vợ/chồng; gốc giữ giá trị nhập tay (mặc định 1). */
export async function recomputeGenerations(db: DB): Promise<number> {
  const ms = await db.all<any>('SELECT id, generation, father_id, mother_id, is_blood FROM members');
  const mr = await db.all<any>('SELECT husband_id, wife_id FROM marriages');
  const byId = new Map(ms.map((m) => [m.id, m]));
  const spouse = new Map<number, number[]>();
  for (const x of mr) {
    spouse.set(x.husband_id, [...(spouse.get(x.husband_id) ?? []), x.wife_id]);
    spouse.set(x.wife_id, [...(spouse.get(x.wife_id) ?? []), x.husband_id]);
  }
  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const gen = (id: number): number => {
    if (memo.has(id)) return memo.get(id)!;
    const m = byId.get(id);
    if (!m || visiting.has(id)) return m?.generation || 1;
    visiting.add(id);
    let g: number;
    const parent = (m.father_id && byId.get(m.father_id)) || (m.mother_id && byId.get(m.mother_id));
    if (parent) g = gen(parent.id) + 1;
    else {
      const sp = (spouse.get(id) ?? []).map((s) => byId.get(s)).find((s) => s && (s.father_id || s.mother_id || s.is_blood));
      g = !m.is_blood && sp ? gen(sp.id) : m.generation || 1;
    }
    visiting.delete(id);
    memo.set(id, g);
    return g;
  };
  // Gom theo số đời để chỉ chạy vài lệnh, kể cả khi cả cây bị dời (thêm tổ tiên phía trên thủy tổ)
  const groups = new Map<number, number[]>();
  for (const m of ms) {
    const g = gen(m.id);
    if (g !== m.generation) groups.set(g, [...(groups.get(g) ?? []), m.id]);
  }
  let n = 0;
  for (const [g, ids] of groups)
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      await db.run(`UPDATE members SET generation = ? WHERE id IN (${part.map(() => '?').join(', ')})`, [g, ...part]);
      n += part.length;
    }
  return n;
}
