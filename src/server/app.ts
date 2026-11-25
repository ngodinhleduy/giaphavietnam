import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { DB } from './db.ts';
import type { Storage } from './storage.ts';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.ts';
import { buildCtx, kinship } from '../shared/kinship.ts';
import { nextSolarOfLunar, lunarToSolar, startOfDay } from '../shared/lunar.ts';
import { slugify } from '../shared/slug.ts';

/** storage: nơi lưu file mới. readers: các storage khác để đọc file cũ (ví dụ ảnh còn trên Drive sau khi chuyển sang NAS). */
export type Deps = { db: DB; storage: Storage; secret: string; readers?: Record<string, Storage> };
type Env = { Variables: { deps: Deps; adminId?: number } };
type C = Context<Env>;

const ADMIN_COOKIE = 'gp_admin';
const VIEW_COOKIE = 'gp_view';
const DAY = 86_400_000;
const MAX_UPLOAD = 15 * 1024 * 1024;

const PUBLIC_SETTINGS = ['site_name', 'site_tagline', 'intro', 'address', 'map_embed', 'contact'];
const MEMBER_FIELDS = [
  'full_name', 'alias', 'gender', 'generation', 'father_id', 'mother_id', 'birth_order', 'is_blood',
  'is_deceased', 'birth_date', 'death_date', 'death_lunar_day', 'death_lunar_month', 'burial_place',
  'hometown', 'occupation', 'branch', 'bio', 'photo_file_id',
] as const;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const bad = (msg: string) => new HttpError(400, msg);

export function createApp(resolveDeps: (c: C) => Deps | Promise<Deps>) {
  const app = new Hono<Env>().basePath('/api');

  app.use('*', async (c, next) => {
    c.set('deps', await resolveDeps(c));
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as any);
    console.error(err);
    return c.json({ error: err.message || 'Lỗi máy chủ' }, 500);
  });

  const db = (c: C) => c.get('deps').db;
  const secure = (c: C) => new URL(c.req.url).protocol === 'https:';

  async function settingsMap(c: C) {
    const rows = await db(c).all<{ key: string; value: string }>('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
  }

  async function isAdmin(c: C) {
    const p = await verifyToken(getCookie(c, ADMIN_COOKIE), c.get('deps').secret);
    return p?.role === 'admin' ? Number(p.sub) : null;
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
  app.get('/site', async (c) => {
    const s = await settingsMap(c);
    const categories = await db(c).all('SELECT id, slug, name FROM categories ORDER BY sort, id');
    const pub = Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, s[k] ?? '']));
    return c.json({
      ...pub,
      locked: !!s.viewer_passcode_hash,
      unlocked: await canView(c),
      categories,
      logo_file_id: s.logo_file_id ? Number(s.logo_file_id) : null,
      banner_file_id: s.banner_file_id ? Number(s.banner_file_id) : null,
    });
  });

  app.post('/viewer/unlock', async (c) => {
    const { passcode } = await c.req.json<{ passcode: string }>();
    const s = await settingsMap(c);
    await new Promise((r) => setTimeout(r, 300)); // làm chậm thử mã
    if (!s.viewer_passcode_hash || !(await verifyPassword(String(passcode ?? ''), s.viewer_passcode_hash))) {
      throw bad('Mã bảo mật không đúng.');
    }
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

  app.get('/articles', async (c) => {
    const cat = c.req.query('category');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const rows = await db(c).all(
      `SELECT a.id, a.slug, a.title, a.summary, a.cover_file_id, a.created_at, c.slug AS category_slug, c.name AS category_name
       FROM articles a LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.published = 1 ${cat ? 'AND c.slug = ?' : ''}
       ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
      cat ? [cat] : [],
    );
    return c.json(rows);
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
    const days = Math.min(Number(c.req.query('days') ?? 365), 800);
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
         WHERE is_deceased = 1 AND death_lunar_day IS NOT NULL AND death_lunar_month IS NOT NULL`,
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
    const obj = await store.get(f.remote_id);
    if (!obj) throw new HttpError(404, 'File không còn trên storage.');
    return new Response(obj.body as any, {
      headers: {
        'content-type': f.mime || obj.mime || 'application/octet-stream',
        'cache-control': isMemberPhoto ? 'private, max-age=86400' : 'public, max-age=604800',
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      },
    });
  });

  // ---------- Viewer (cần mã bảo mật) ----------
  app.get('/tree', requireViewer, async (c) => {
    const members = await db(c).all(
      `SELECT id, full_name, alias, gender, generation, father_id, mother_id, birth_order, is_blood, is_deceased,
              birth_date, death_date, branch, photo_file_id FROM members ORDER BY generation, birth_order, id`,
    );
    const marriages = await db(c).all('SELECT id, husband_id, wife_id, order_no FROM marriages ORDER BY order_no, id');
    return c.json({ members, marriages });
  });

  app.get('/members/:id', requireViewer, async (c) => {
    const id = Number(c.req.param('id'));
    const m = await db(c).first<any>('SELECT * FROM members WHERE id = ?', [id]);
    if (!m) throw new HttpError(404, 'Không tìm thấy thành viên.');
    const brief = 'id, full_name, gender, generation, is_deceased, birth_date, death_date, photo_file_id, birth_order';
    const [father, mother, children, spouses] = await Promise.all([
      m.father_id ? db(c).first(`SELECT ${brief} FROM members WHERE id = ?`, [m.father_id]) : null,
      m.mother_id ? db(c).first(`SELECT ${brief} FROM members WHERE id = ?`, [m.mother_id]) : null,
      db(c).all(`SELECT ${brief} FROM members WHERE father_id = ? OR mother_id = ? ORDER BY birth_order, birth_date, id`, [id, id]),
      db(c).all(
        `SELECT ${brief.split(', ').map((f) => 'm.' + f).join(', ')}, mr.order_no, mr.id AS marriage_id FROM marriages mr
         JOIN members m ON m.id = CASE WHEN mr.husband_id = ? THEN mr.wife_id ELSE mr.husband_id END
         WHERE mr.husband_id = ? OR mr.wife_id = ? ORDER BY mr.order_no`,
        [id, id, id],
      ),
    ]);
    return c.json({ ...m, father, mother, children, spouses });
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

  app.get('/export/members.csv', requireViewer, async (c) => {
    const rows = await db(c).all<any>(
      `SELECT m.id, m.generation, m.full_name, m.alias, m.gender, f.full_name AS father, mo.full_name AS mother,
              m.birth_order, m.birth_date, m.death_date, m.death_lunar_day, m.death_lunar_month, m.is_deceased,
              m.is_blood, m.branch, m.hometown, m.burial_place
       FROM members m LEFT JOIN members f ON f.id = m.father_id LEFT JOIN members mo ON mo.id = m.mother_id
       ORDER BY m.generation, m.id`,
    );
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
    const { username, password } = await c.req.json<{ username: string; password: string }>();
    await new Promise((r) => setTimeout(r, 300));
    const u = await db(c).first<any>('SELECT * FROM admins WHERE username = ?', [String(username ?? '').trim()]);
    if (!u || !(await verifyPassword(String(password ?? ''), u.password_hash))) throw bad('Sai tên đăng nhập hoặc mật khẩu.');
    await db(c).run("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?", [u.id]);
    const token = await signToken({ sub: String(u.id), role: 'admin', exp: Date.now() + 7 * DAY }, c.get('deps').secret);
    setCookie(c, ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: secure(c), path: '/', maxAge: 7 * 86400 });
    return c.json({ id: u.id, username: u.username, display_name: u.display_name });
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
    if (!id) return c.json({ error: 'Phiên đăng nhập hết hạn.' }, 401);
    c.set('adminId', id);
    await next();
  });

  app.get('/admin/me', async (c) => {
    return c.json(await db(c).first('SELECT id, username, display_name FROM admins WHERE id = ?', [c.get('adminId')]));
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
    return c.json({ members, living, deceased, generations, articles, events, albums, photos, orphans: missing,
      storage: c.get('deps').storage.kind });
  });

  // Members
  app.get('/admin/members', async (c) => {
    return c.json(
      await db(c).all(
        `SELECT m.id, m.full_name, m.alias, m.gender, m.generation, m.father_id, m.mother_id, m.birth_order, m.is_blood,
                m.is_deceased, m.birth_date, m.death_date, m.branch, m.photo_file_id, m.updated_at,
                f.full_name AS father_name, mo.full_name AS mother_name
         FROM members m LEFT JOIN members f ON f.id = m.father_id LEFT JOIN members mo ON mo.id = m.mother_id
         ORDER BY m.generation, m.birth_order, m.id`,
      ),
    );
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

  app.post('/admin/members', async (c) => {
    const body = await c.req.json<any>();
    await validateMember(c, body);
    const r = await db(c).run(
      `INSERT INTO members (${MEMBER_FIELDS.join(', ')}) VALUES (${MEMBER_FIELDS.map(() => '?').join(', ')})`,
      pick({ is_blood: 1, is_deceased: 0, ...body, full_name: body.full_name.trim() }),
    );
    if (body.spouse_id) await addMarriage(c, r.lastId, Number(body.spouse_id), 1);
    await recomputeGenerations(db(c));
    return c.json({ id: r.lastId });
  });

  app.put('/admin/members/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const existing = await db(c).first<any>('SELECT * FROM members WHERE id = ?', [id]);
    if (!existing) throw new HttpError(404, 'Không tìm thấy.');
    // Trường không gửi lên thì giữ nguyên giá trị cũ
    const body = { ...existing, ...(await c.req.json<any>()) };
    await validateMember(c, body, id);
    await db(c).run(
      `UPDATE members SET ${MEMBER_FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      [...pick({ ...body, full_name: body.full_name.trim() }), id],
    );
    await recomputeGenerations(db(c));
    return c.json({ ok: true });
  });

  app.delete('/admin/members/:id', async (c) => {
    const id = Number(c.req.param('id'));
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
    const r = await addMarriage(c, Number(b.a), Number(b.b), Number(b.order_no) || 1, b.note);
    await recomputeGenerations(db(c));
    return c.json({ id: r.lastId });
  });
  app.put('/admin/marriages/:id', async (c) => {
    const b = await c.req.json<any>();
    await db(c).run('UPDATE marriages SET order_no = ?, note = ? WHERE id = ?', [Number(b.order_no) || 1, b.note, c.req.param('id')]);
    return c.json({ ok: true });
  });
  app.delete('/admin/marriages/:id', async (c) => {
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
    const storage = c.get('deps').storage;
    const remote = await storage.put(file.name, file.type || 'application/octet-stream', new Uint8Array(await file.arrayBuffer()));
    const r = await db(c).run('INSERT INTO files (storage, remote_id, name, mime, size) VALUES (?, ?, ?, ?, ?)', [
      storage.kind, remote, file.name, file.type || 'application/octet-stream', file.size,
    ]);
    return c.json({ id: r.lastId, name: file.name });
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
  app.get('/admin/articles', async (c) =>
    c.json(
      await db(c).all(
        `SELECT a.id, a.slug, a.title, a.published, a.created_at, a.updated_at, c.name AS category_name
         FROM articles a LEFT JOIN categories c ON c.id = a.category_id ORDER BY a.created_at DESC, a.id DESC`,
      ),
    ),
  );
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
  app.post('/admin/articles', async (c) => {
    const b = await c.req.json<any>();
    if (!b.title?.trim()) throw bad('Tiêu đề bắt buộc.');
    const slug = await uniqueSlug(c, slugify(b.slug || b.title));
    const r = await db(c).run(
      'INSERT INTO articles (category_id, slug, title, summary, content, cover_file_id, published) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [b.category_id, slug, b.title.trim(), b.summary, b.content, b.cover_file_id, b.published ?? 1],
    );
    return c.json({ id: r.lastId, slug });
  });
  app.put('/admin/articles/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const b = await c.req.json<any>();
    if (!b.title?.trim()) throw bad('Tiêu đề bắt buộc.');
    const slug = await uniqueSlug(c, slugify(b.slug || b.title), id);
    await db(c).run(
      `UPDATE articles SET category_id = ?, slug = ?, title = ?, summary = ?, content = ?, cover_file_id = ?, published = ?,
       updated_at = datetime('now') WHERE id = ?`,
      [b.category_id, slug, b.title.trim(), b.summary, b.content, b.cover_file_id, b.published ?? 1, id],
    );
    return c.json({ ok: true, slug });
  });
  app.delete('/admin/articles/:id', async (c) => {
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
    const allowed = [...PUBLIC_SETTINGS, 'logo_file_id', 'banner_file_id'];
    for (const k of allowed)
      if (k in b) await db(c).run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, String(b[k] ?? '')]);
    if ('passcode' in b) {
      const p = String(b.passcode ?? '');
      if (p && p.length < 4) throw bad('Mã bảo mật tối thiểu 4 ký tự.');
      await db(c).run("INSERT OR REPLACE INTO settings (key, value) VALUES ('viewer_passcode_hash', ?)", [
        p ? await hashPassword(p) : '',
      ]);
    }
    return c.json({ ok: true });
  });

  // Admins
  app.get('/admin/admins', async (c) =>
    c.json(await db(c).all('SELECT id, username, display_name, created_at, last_login_at FROM admins ORDER BY id')),
  );
  const validUsername = (u: string) => /^[a-zA-Z0-9._-]{3,32}$/.test(u);
  app.post('/admin/admins', async (c) => {
    const b = await c.req.json<any>();
    const username = String(b.username ?? '').trim();
    if (!validUsername(username)) throw bad('Tên đăng nhập 3-32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.');
    if (String(b.password ?? '').length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự.');
    if (await db(c).first('SELECT 1 FROM admins WHERE username = ?', [username])) throw bad('Tên đăng nhập đã tồn tại.');
    const r = await db(c).run('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)', [
      username, await hashPassword(b.password), String(b.display_name ?? '').trim() || username,
    ]);
    return c.json({ id: r.lastId });
  });
  app.put('/admin/admins/:id', async (c) => {
    const b = await c.req.json<any>();
    const name = String(b.display_name ?? '').trim();
    if (!name) throw bad('Tên hiển thị không được để trống.');
    await db(c).run('UPDATE admins SET display_name = ? WHERE id = ?', [name, c.req.param('id')]);
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
    await db(c).run('UPDATE admins SET password_hash = ? WHERE id = ?', [await hashPassword(b.next), u.id]);
    return c.json({ ok: true });
  });
  app.delete('/admin/admins/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (id === c.get('adminId')) throw bad('Không thể tự xóa tài khoản đang đăng nhập.');
    const n = await db(c).first<{ n: number }>('SELECT COUNT(*) AS n FROM admins');
    if ((n?.n ?? 0) <= 1) throw bad('Phải còn ít nhất một người quản trị.');
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
  let n = 0;
  for (const m of ms) {
    const g = gen(m.id);
    if (g !== m.generation) {
      await db.run('UPDATE members SET generation = ? WHERE id = ?', [g, m.id]);
      n++;
    }
  }
  return n;
}
