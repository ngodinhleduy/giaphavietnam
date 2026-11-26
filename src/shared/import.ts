// Đọc bảng thành viên từ Excel/CSV thành kế hoạch nhập: ghép cột, kiểm tra từng dòng, nối cha mẹ, vợ chồng, tính đời.
// Không phụ thuộc trình duyệt để kiểm thử được bằng Node.
import { fold } from './slug.ts';

export type Cell = string | number | boolean | Date | null | undefined;

export const IMPORT_FIELDS = [
  { key: 'ref', label: 'Mã trong file', aliases: ['ma', 'id', 'ma so', 'stt', 'personid', 'ma thanh vien'] },
  { key: 'full_name', label: 'Họ tên', aliases: ['ho ten', 'ho va ten', 'ten', 'fullname', 'full name', 'ho ten day du'] },
  { key: 'alias', label: 'Tên khác', aliases: ['ten khac', 'ten thuong goi', 'biet danh', 'nickname', 'ten tu', 'ten huy'] },
  { key: 'gender', label: 'Giới tính', aliases: ['gioi tinh', 'gender', 'phai'] },
  { key: 'generation', label: 'Đời', aliases: ['doi', 'doi thu', 'the he', 'generationorder'] },
  { key: 'father_ref', label: 'Mã cha', aliases: ['ma cha', 'ma bo', 'fatherid', 'id cha', 'parentid'] },
  { key: 'mother_ref', label: 'Mã mẹ', aliases: ['ma me', 'motherid', 'id me'] },
  { key: 'father_name', label: 'Tên cha', aliases: ['cha', 'bo', 'ten cha', 'ho ten cha'] },
  { key: 'mother_name', label: 'Tên mẹ', aliases: ['me', 'ten me', 'ho ten me'] },
  { key: 'spouse_refs', label: 'Mã vợ/chồng', aliases: ['ma vo chong', 'spouseids', 'ma vo', 'ma chong', 'ma phoi ngau'] },
  { key: 'spouse_name', label: 'Tên vợ/chồng', aliases: ['vo chong', 'vo', 'chong', 'phoi ngau', 'ten vo chong'] },
  { key: 'birth_order', label: 'Con thứ', aliases: ['thu', 'con thu', 'thu tu', 'ordersort'] },
  { key: 'birth_date', label: 'Ngày sinh', aliases: ['ngay sinh', 'nam sinh', 'sinh', 'birthtext', 'birthday'] },
  { key: 'death_date', label: 'Ngày mất', aliases: ['ngay mat', 'nam mat', 'mat', 'deathtext'] },
  { key: 'death_lunar', label: 'Ngày giỗ (âm lịch)', aliases: ['gio am', 'gio', 'ngay gio', 'ngay gio am lich', 'gio am lich'] },
  { key: 'is_deceased', label: 'Đã mất', aliases: ['da mat', 'isdied'] },
  { key: 'is_blood', label: 'Huyết thống', aliases: ['huyet thong', 'trong ho', 'isfamily'] },
  { key: 'branch', label: 'Chi', aliases: ['chi', 'nhanh', 'chi nhanh'] },
  { key: 'hometown', label: 'Quê quán', aliases: ['que quan', 'que'] },
  { key: 'burial_place', label: 'Nơi an táng', aliases: ['noi an tang', 'mo phan', 'an tang'] },
  { key: 'occupation', label: 'Nghề nghiệp', aliases: ['nghe nghiep', 'nghe'] },
  { key: 'title_role', label: 'Chức danh, vai vế', aliases: ['chuc danh vai ve', 'chuc danh', 'vai ve', 'titlerole', 'chuc vu'] },
  { key: 'child_type', label: 'Loại con', aliases: ['loai con', 'childtype', 'quan he voi cha me'] },
  { key: 'is_hidden', label: 'Ẩn trên website', aliases: ['an tren website', 'an', 'ishidden'] },
  { key: 'bio', label: 'Tiểu sử', aliases: ['tieu su', 'ghi chu', 'note'] },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<ImportField, number>>;

const text = (v: Cell) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();
const normHead = (v: Cell) => fold(text(v)).replace(/\s+/g, ' ').trim();

/** Đoán cột nào ứng với trường nào dựa theo tiêu đề. Mỗi cột chỉ dùng một lần. */
export function guessMapping(headers: Cell[]): Mapping {
  const heads = headers.map(normHead);
  const map: Mapping = {};
  const used = new Set<number>();
  for (const f of IMPORT_FIELDS) {
    for (const a of f.aliases) {
      const i = heads.findIndex((h, idx) => h === a && !used.has(idx));
      if (i >= 0) { map[f.key] = i; used.add(i); break; }
    }
  }
  return map;
}

/** Đọc CSV có dấu ngoặc kép, dấu phẩy hoặc chấm phẩy, có hoặc không có BOM. */
export function parseCsv(src: string): string[][] {
  const s = src.replace(/^﻿/, '');
  const firstLine = s.slice(0, s.search(/\r?\n/) < 0 ? s.length : s.search(/\r?\n/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const pad = (n: number) => String(n).padStart(2, '0');
const validYmd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return y >= 1 && t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Ngày về dạng YYYY-MM-DD hoặc YYYY. undefined: không đọc được. */
function parseDate(v: Cell): string | null | undefined {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const s = String(v).trim();
  if (!s || s === '?' || s === '-') return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{3,4})$/))) return m[1].padStart(4, '0');
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return validYmd(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : undefined;
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) return validYmd(+m[3], +m[2], +m[1]) ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : undefined;
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{4})$/))) return +m[1] >= 1 && +m[1] <= 12 ? m[2] : undefined;
  if ((m = s.match(/(?:^|\D)(\d{4})$/))) return m[1]; // "khoảng 1890", "năm 1890"
  return undefined;
}

function parseLunar(v: Cell): { day: number; month: number } | null | undefined {
  const s = text(v);
  if (!s) return null;
  const m = fold(s).match(/(\d{1,2})\D+(\d{1,2})/);
  if (!m) return undefined;
  const day = +m[1];
  const month = +m[2];
  return day >= 1 && day <= 30 && month >= 1 && month <= 12 ? { day, month } : undefined;
}

const YES = new Set(['co', 'x', '1', 'true', 'yes', 'y', 'da mat', 'mat', 'roi', 'an', 'dung']);
const NO = new Set(['khong', '0', 'false', 'no', 'n', 'con song', 'chua', 'hien']);
const bool = (v: Cell): boolean | null => {
  if (typeof v === 'boolean') return v;
  const s = fold(text(v));
  return YES.has(s) ? true : NO.has(s) ? false : null;
};
function parseGender(v: Cell): 'male' | 'female' | null {
  const s = fold(text(v));
  if (['nam', 'male', 'm', 'trai', 'ong', 'con trai'].includes(s)) return 'male';
  if (['nu', 'female', 'f', 'gai', 'ba', 'con gai'].includes(s)) return 'female';
  return null;
}
function parseBlood(v: Cell): 0 | 1 | null {
  const s = fold(text(v));
  if (!s) return null;
  if (/dau|re\b|ngoai/.test(s) || NO.has(s)) return 0;
  return 1;
}
function parseChildType(v: Cell): 'biological' | 'adopted' | 'out_of_wedlock' {
  const s = fold(text(v));
  if (s.includes('nuoi') || s === 'adopted') return 'adopted';
  if (s.includes('ngoai gia thu') || s === 'out_of_wedlock') return 'out_of_wedlock';
  return 'biological';
}
const splitList = (v: Cell) => text(v).split(/[;,\n|]+/).map((x) => x.trim()).filter(Boolean);

export type Existing = { id: number; full_name: string; gender: 'male' | 'female'; generation: number | null; birth_date: string | null };

type ImportItem = {
  ref: string; line: number; full_name: string; gender: 'male' | 'female'; generation: number;
  father_ref: string | null; mother_ref: string | null;
  alias: string | null; birth_order: number | null; birth_date: string | null; death_date: string | null;
  death_lunar_day: number | null; death_lunar_month: number | null; is_deceased: 0 | 1; is_blood: 0 | 1;
  branch: string | null; hometown: string | null; burial_place: string | null; occupation: string | null;
  title_role: string | null; child_type: string; is_hidden: 0 | 1; bio: string | null;
};
export type Note = { line: number; name: string; text: string };
export type ImportPlan = {
  items: ImportItem[];                 // cha mẹ đứng trước con
  pairs: { a: string; b: string; order_no: number }[];
  known: Record<string, number>;       // mã "db:<id>" trỏ tới người đã có sẵn
  errors: Note[];
  warnings: Note[];
  skipped: number;
  generations: number;
};

type Raw = ImportItem & {
  father_name: string; mother_name: string; spouse_refs: string[]; spouse_names: string[];
  blood_given: 0 | 1 | null; gen_given: number | null; gender_raw: 'male' | 'female' | null;
};

/**
 * rows: các dòng dữ liệu (không gồm dòng tiêu đề). firstLine: số dòng trong file của dòng dữ liệu đầu tiên.
 * skipErrors: bỏ các dòng lỗi, nhập phần còn lại.
 */
export function buildPlan(rows: Cell[][], map: Mapping, existing: Existing[], opt: { skipErrors?: boolean; firstLine?: number } = {}): ImportPlan {
  const errors: Note[] = [];
  const warnings: Note[] = [];
  const firstLine = opt.firstLine ?? 2;
  const cell = (r: Cell[], f: ImportField): Cell => (map[f] == null ? null : r[map[f]!]);
  const str = (r: Cell[], f: ImportField) => text(cell(r, f)) || null;

  // 1. Đọc từng dòng
  const raws: Raw[] = [];
  const refSeen = new Map<string, number>();
  rows.forEach((r, i) => {
    const line = firstLine + i;
    if (!r.some((c) => text(c))) return;
    const name = text(cell(r, 'full_name'));
    const note = (list: Note[], t: string) => list.push({ line, name: name || '(chưa có tên)', text: t });
    if (!name) return note(errors, 'Thiếu họ tên.');
    const ref = text(cell(r, 'ref')) || `#${line}`;
    if (refSeen.has(ref)) return note(errors, `Mã "${ref}" bị trùng với dòng ${refSeen.get(ref)}.`);
    refSeen.set(ref, line);

    const birth = parseDate(cell(r, 'birth_date'));
    if (birth === undefined) note(warnings, `Không đọc được ngày sinh "${text(cell(r, 'birth_date'))}", để trống.`);
    const death = parseDate(cell(r, 'death_date'));
    if (death === undefined) note(warnings, `Không đọc được ngày mất "${text(cell(r, 'death_date'))}", để trống.`);
    const lunar = parseLunar(cell(r, 'death_lunar'));
    if (lunar === undefined) note(warnings, `Không đọc được ngày giỗ "${text(cell(r, 'death_lunar'))}", để trống.`);
    const dead = bool(cell(r, 'is_deceased'));
    const genRaw = Number(text(cell(r, 'generation')).replace(/\D/g, ''));
    const order = Number(text(cell(r, 'birth_order')).replace(/\D/g, ''));

    raws.push({
      ref, line, full_name: name, gender: 'male', gender_raw: parseGender(cell(r, 'gender')), generation: 1,
      gen_given: genRaw > 0 && genRaw < 200 ? genRaw : null,
      father_ref: str(r, 'father_ref'), mother_ref: str(r, 'mother_ref'),
      father_name: text(cell(r, 'father_name')), mother_name: text(cell(r, 'mother_name')),
      spouse_refs: splitList(cell(r, 'spouse_refs')), spouse_names: splitList(cell(r, 'spouse_name')),
      alias: str(r, 'alias'), birth_order: order > 0 && order < 100 ? order : null,
      birth_date: birth ?? null, death_date: death ?? null,
      death_lunar_day: lunar?.day ?? null, death_lunar_month: lunar?.month ?? null,
      is_deceased: dead ?? !!(death || lunar) ? 1 : 0,
      is_blood: 1, blood_given: parseBlood(cell(r, 'is_blood')),
      branch: str(r, 'branch'), hometown: str(r, 'hometown'), burial_place: str(r, 'burial_place'),
      occupation: str(r, 'occupation'), title_role: str(r, 'title_role'), child_type: parseChildType(cell(r, 'child_type')),
      is_hidden: bool(cell(r, 'is_hidden')) ? 1 : 0, bio: str(r, 'bio'),
    });
  });

  // 2. Nối quan hệ. Chạy lại khi bỏ dòng lỗi để các liên kết tới dòng bị bỏ được gỡ sạch.
  const link = (list: Raw[], errs: Note[], warns: Note[], strict: boolean) => {
    const byRef = new Map(list.map((x) => [x.ref, x]));
    const byName = new Map<string, Raw[]>();
    for (const x of list) byName.set(fold(x.full_name), [...(byName.get(fold(x.full_name)) ?? []), x]);
    const dbByName = new Map<string, Existing[]>();
    for (const e of existing) dbByName.set(fold(e.full_name), [...(dbByName.get(fold(e.full_name)) ?? []), e]);
    const known: Record<string, number> = {};
    const bad = new Set<string>();
    const err = (x: Raw, t: string) => { errs.push({ line: x.line, name: x.full_name, text: t }); bad.add(x.ref); };
    const warn = (x: Raw, t: string) => warns.push({ line: x.line, name: x.full_name, text: t });

    // Tìm một người theo tên: ưu tiên trong file, sau đó tới người đã có trong phả
    const findByName = (x: Raw, name: string, gender: 'male' | 'female' | null, what: string): string | null => {
      let c = (byName.get(fold(name)) ?? []).filter((y) => y.ref !== x.ref && (!gender || !y.gender_raw || y.gender_raw === gender));
      if (c.length > 1 && x.gen_given && what !== 'vợ/chồng') {
        const near = c.filter((y) => y.gen_given === x.gen_given! - 1);
        if (near.length) c = near;
      }
      if (c.length === 1) return c[0].ref;
      if (c.length > 1) { warn(x, `Có ${c.length} người tên "${name}" trong file nên chưa nối được ${what}. Hãy dùng cột mã.`); return null; }
      const d = (dbByName.get(fold(name)) ?? []).filter((y) => !gender || y.gender === gender);
      if (d.length === 1) { known[`db:${d[0].id}`] = d[0].id; return `db:${d[0].id}`; }
      warn(x, d.length > 1 ? `Có ${d.length} người tên "${name}" trong phả nên chưa nối được ${what}.` : `Không tìm thấy ${what} tên "${name}".`);
      return null;
    };

    const fRef = new Map<string, string | null>();
    const mRef = new Map<string, string | null>();
    for (const x of list) {
      for (const [side, refMap, gender, label] of [['father', fRef, 'male', 'cha'], ['mother', mRef, 'female', 'mẹ']] as const) {
        const code = x[`${side}_ref`];
        const name = x[`${side}_name`];
        let hit: string | null = null;
        if (code) {
          if (byRef.has(code)) hit = code;
          else if (!strict) warn(x, `Mã ${label} "${code}" không có trong phần được nhập, bỏ liên kết.`);
          else err(x, `Mã ${label} "${code}" không có trong file.`);
        } else if (name) hit = findByName(x, name, gender, label);
        if (hit === x.ref) { err(x, `Không thể là ${label} của chính mình.`); hit = null; }
        refMap.set(x.ref, hit);
      }
    }

    // Giới tính: lấy từ cột, nếu trống thì suy ra từ vai trò cha hoặc mẹ
    const asFather = new Set([...fRef.values()].filter(Boolean) as string[]);
    const asMother = new Set([...mRef.values()].filter(Boolean) as string[]);
    for (const x of list) {
      const g = x.gender_raw ?? (asFather.has(x.ref) ? 'male' : asMother.has(x.ref) ? 'female' : null);
      if (!g) err(x, 'Thiếu hoặc không đọc được giới tính (ghi Nam hoặc Nữ).');
      else x.gender = g;
    }
    const genderOf = (ref: string) => (ref.startsWith('db:') ? existing.find((e) => e.id === known[ref])?.gender : byRef.get(ref)?.gender);
    for (const x of list) {
      const f = fRef.get(x.ref);
      const m = mRef.get(x.ref);
      if (f && !bad.has(f) && genderOf(f) !== 'male') err(x, 'Người được ghi là cha lại có giới tính nữ.');
      if (m && !bad.has(m) && genderOf(m) !== 'female') err(x, 'Người được ghi là mẹ lại có giới tính nam.');
    }

    // Vòng lặp cha con
    const state = new Map<string, 1 | 2>();
    const walk = (ref: string, path: string[]): boolean => {
      if (state.get(ref) === 2 || ref.startsWith('db:')) return false;
      if (state.get(ref) === 1) {
        for (const r of path.slice(path.indexOf(ref))) { const y = byRef.get(r)!; if (!bad.has(r)) err(y, 'Quan hệ cha mẹ bị vòng lặp: người này lại là tổ tiên của chính mình.'); }
        return true;
      }
      state.set(ref, 1);
      for (const p of [fRef.get(ref), mRef.get(ref)]) if (p) walk(p, [...path, ref]);
      state.set(ref, 2);
      return false;
    };
    for (const x of list) walk(x.ref, []);

    // Hôn nhân: từ cột vợ/chồng, rồi từ các cặp cha mẹ có con chung
    const pairs: { a: string; b: string; order_no: number }[] = [];
    const pairKey = new Set<string>();
    const addPair = (a: string, b: string, order: number) => {
      const k = [a, b].sort().join('|');
      if (a === b || pairKey.has(k)) return;
      pairKey.add(k);
      pairs.push({ a, b, order_no: order });
    };
    for (const x of list) {
      const sp: string[] = [];
      for (const code of x.spouse_refs) {
        if (byRef.has(code)) sp.push(code);
        else if (!strict) warn(x, `Mã vợ/chồng "${code}" không có trong phần được nhập, bỏ liên kết.`);
        else err(x, `Mã vợ/chồng "${code}" không có trong file.`);
      }
      if (!x.spouse_refs.length)
        for (const name of x.spouse_names) { const h = findByName(x, name, x.gender === 'male' ? 'female' : 'male', 'vợ/chồng'); if (h) sp.push(h); }
      sp.forEach((s, i) => {
        if (genderOf(s) === x.gender) return warn(x, 'Vợ chồng cần một nam và một nữ, bỏ qua liên kết hôn nhân này.');
        addPair(x.ref, s, x.gender === 'male' ? i + 1 : 1);
      });
    }
    const wivesOf = new Map<string, number>();
    for (const p of pairs) for (const r of [p.a, p.b]) if (genderOf(r) === 'male') wivesOf.set(r, Math.max(wivesOf.get(r) ?? 0, p.order_no));
    for (const x of list) {
      const f = fRef.get(x.ref);
      const m = mRef.get(x.ref);
      if (f && m && !pairKey.has([f, m].sort().join('|'))) {
        const n = (wivesOf.get(f) ?? 0) + 1;
        wivesOf.set(f, n);
        addPair(f, m, n);
      }
    }
    return { byRef, fRef, mRef, pairs, known, bad };
  };

  let list = raws;
  let res = link(list, errors, warnings, true);
  let skipped = 0;
  if (opt.skipErrors && errors.length) {
    const badLines = new Set(errors.map((e) => e.line));
    skipped = badLines.size;
    list = raws.filter((x) => !badLines.has(x.line));
    const again: Note[] = [];
    const w2: Note[] = [];
    res = link(list, again, w2, false);
    warnings.length = 0;
    warnings.push(...w2);
    // Lỗi mới sinh ra sau khi bỏ dòng (hiếm): bỏ nốt các dòng đó
    if (again.length) {
      const more = new Set(again.map((e) => e.line));
      skipped += more.size;
      errors.push(...again);
      list = list.filter((x) => !more.has(x.line));
      res = link(list, [], [], false);
    }
  }
  const { byRef, fRef, mRef, pairs, known } = res;

  // 3. Dâu rể: theo cột nếu có, không thì suy từ quan hệ
  const spousesOf = new Map<string, string[]>();
  for (const p of pairs) { spousesOf.set(p.a, [...(spousesOf.get(p.a) ?? []), p.b]); spousesOf.set(p.b, [...(spousesOf.get(p.b) ?? []), p.a]); }
  const hasParent = (ref: string) => (ref.startsWith('db:') ? true : !!(fRef.get(ref) || mRef.get(ref)));
  for (const x of list) {
    if (x.blood_given != null) { x.is_blood = x.blood_given; continue; }
    const sp = spousesOf.get(x.ref) ?? [];
    if (hasParent(x.ref) || !sp.length) { x.is_blood = 1; continue; }
    // Không có cha mẹ trong phả và có vợ/chồng: là dâu rể nếu bên kia có cha mẹ; cặp thủy tổ thì người vợ tính là dâu
    x.is_blood = sp.some(hasParent) || x.gender === 'female' ? 0 : 1;
  }

  // 4. Đời: con bằng đời cha mẹ cộng một, dâu rể theo đời vợ chồng, gốc giữ số trong file hoặc 1
  const dbGen = new Map(existing.map((e) => [`db:${e.id}`, e.generation || 1]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const gen = (ref: string): number => {
    if (dbGen.has(ref)) return dbGen.get(ref)!;
    if (memo.has(ref)) return memo.get(ref)!;
    const x = byRef.get(ref);
    if (!x || visiting.has(ref)) return x?.gen_given || 1;
    visiting.add(ref);
    const p = fRef.get(ref) || mRef.get(ref);
    let g: number;
    if (p) g = gen(p) + 1;
    else {
      const s = !x.is_blood ? (spousesOf.get(ref) ?? []).find((r) => hasParent(r) || byRef.get(r)?.is_blood) : undefined;
      g = s ? gen(s) : x.gen_given || 1;
    }
    visiting.delete(ref);
    memo.set(ref, g);
    return g;
  };
  for (const x of list) {
    x.generation = gen(x.ref);
    if (x.gen_given && x.gen_given !== x.generation)
      warnings.push({ line: x.line, name: x.full_name, text: `File ghi đời ${x.gen_given} nhưng theo cha mẹ là đời ${x.generation}. Dùng đời ${x.generation}.` });
  }

  // 5. Trùng với người đã có trong phả
  const dbKey = new Set(existing.map((e) => `${fold(e.full_name)}|${e.birth_date ?? ''}`));
  for (const x of list)
    if (dbKey.has(`${fold(x.full_name)}|${x.birth_date ?? ''}`))
      warnings.push({ line: x.line, name: x.full_name, text: 'Trong phả đã có người cùng họ tên và ngày sinh. Kiểm tra để tránh nhập trùng.' });

  // 6. Sắp cha mẹ trước con
  const done = new Set<string>();
  const items: ImportItem[] = [];
  const put = (x: Raw) => {
    if (done.has(x.ref)) return;
    done.add(x.ref);
    for (const p of [fRef.get(x.ref), mRef.get(x.ref)]) if (p && byRef.has(p)) put(byRef.get(p)!);
    const { father_name: _f, mother_name: _m, spouse_refs: _s, spouse_names: _n, blood_given: _b, gen_given: _g, gender_raw: _r, ...item } = x;
    items.push({ ...item, father_ref: fRef.get(x.ref) ?? null, mother_ref: mRef.get(x.ref) ?? null });
  };
  [...list].sort((a, b) => a.generation - b.generation || a.line - b.line).forEach(put);

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);
  return {
    items, pairs, known, errors, warnings, skipped,
    generations: items.length ? Math.max(...items.map((i) => i.generation)) - Math.min(...items.map((i) => i.generation)) + 1 : 0,
  };
}

/** Các cột của file mẫu và file xuất. Nhập lại file xuất sẽ cho đúng cây ban đầu. */
export const EXPORT_COLUMNS = [
  'Mã', 'Họ tên', 'Tên khác', 'Giới tính', 'Đời', 'Mã cha', 'Mã mẹ', 'Mã vợ/chồng', 'Con thứ', 'Ngày sinh', 'Ngày mất',
  'Ngày giỗ (âm lịch)', 'Đã mất', 'Huyết thống', 'Chi', 'Quê quán', 'Nơi an táng', 'Nghề nghiệp', 'Chức danh', 'Loại con', 'Ẩn trên website',
] as const;

export function exportRows(members: any[], marriages: { husband_id: number; wife_id: number; order_no: number }[]): (string | number)[][] {
  const sp = new Map<number, number[]>();
  for (const m of [...marriages].sort((a, b) => a.order_no - b.order_no)) {
    sp.set(m.husband_id, [...(sp.get(m.husband_id) ?? []), m.wife_id]);
  }
  const dmy = (d?: string | null) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return dd ? `${dd}/${m}/${y}` : y; };
  return members.map((m) => [
    m.id, m.full_name, m.alias ?? '', m.gender === 'male' ? 'Nam' : 'Nữ', m.generation ?? '', m.father_id ?? '', m.mother_id ?? '',
    (sp.get(m.id) ?? []).join('; '), m.birth_order ?? '', dmy(m.birth_date), dmy(m.death_date),
    m.death_lunar_day ? `${m.death_lunar_day}/${m.death_lunar_month}` : '', m.is_deceased ? 'Có' : '', m.is_blood ? 'Có' : 'Dâu/rể',
    m.branch ?? '', m.hometown ?? '', m.burial_place ?? '', m.occupation ?? '', m.title_role ?? '',
    m.child_type === 'adopted' ? 'Con nuôi' : m.child_type === 'out_of_wedlock' ? 'Con ngoài giá thú' : '', m.is_hidden ? 'Có' : '',
  ]);
}
