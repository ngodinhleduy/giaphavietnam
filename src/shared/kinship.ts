// Tính quan hệ xưng hô giữa hai thành viên theo cách gọi miền Bắc.
// Kết quả trả lời câu hỏi: "A gọi B là gì?"
export type KMember = {
  id: number;
  full_name: string;
  gender: 'male' | 'female';
  father_id: number | null;
  mother_id: number | null;
  birth_order: number | null;
  birth_date: string | null;
};
export type KMarriage = { husband_id: number; wife_id: number };

export type KinshipResult = {
  term: string; // A gọi B là ...
  detail: string;
  ancestorId?: number;
};

type Ctx = { byId: Map<number, KMember>; spouses: Map<number, number[]> };

export function buildCtx(members: KMember[], marriages: KMarriage[]): Ctx {
  const byId = new Map(members.map((m) => [m.id, m]));
  const spouses = new Map<number, number[]>();
  for (const m of marriages) {
    spouses.set(m.husband_id, [...(spouses.get(m.husband_id) ?? []), m.wife_id]);
    spouses.set(m.wife_id, [...(spouses.get(m.wife_id) ?? []), m.husband_id]);
  }
  return { byId, spouses };
}

// Tổ tiên của một người: id -> {depth, path từ người đó lên (không gồm chính nó)}
function ancestors(ctx: Ctx, id: number) {
  const out = new Map<number, { depth: number; path: number[] }>();
  out.set(id, { depth: 0, path: [] });
  const q = [id];
  while (q.length) {
    const cur = q.shift()!;
    const info = out.get(cur)!;
    const m = ctx.byId.get(cur);
    if (!m || info.depth > 30) continue;
    for (const p of [m.father_id, m.mother_id]) {
      if (p && ctx.byId.has(p) && !out.has(p)) {
        out.set(p, { depth: info.depth + 1, path: [...info.path, p] });
        q.push(p);
      }
    }
  }
  return out;
}

function yearOf(m: KMember) {
  const y = m.birth_date ? parseInt(m.birth_date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
}

/** true nếu x thuộc vai trên (lớn hơn) y. Ưu tiên thứ tự anh em, rồi năm sinh, rồi id. */
function isSenior(x: KMember, y: KMember) {
  if (x.birth_order && y.birth_order && x.birth_order !== y.birth_order) return x.birth_order < y.birth_order;
  const a = yearOf(x);
  const b = yearOf(y);
  if (a && b && a !== b) return a < b;
  return x.id < y.id;
}

const DESC = ['', 'con', 'cháu', 'chắt', 'chút', 'chít'];
const ASC_M = ['', 'bố', 'ông', 'cụ ông', 'kỵ ông'];
const ASC_F = ['', 'mẹ', 'bà', 'cụ bà', 'kỵ bà'];

export function bloodRelation(ctx: Ctx, aId: number, bId: number): KinshipResult | null {
  const A = ctx.byId.get(aId);
  const B = ctx.byId.get(bId);
  if (!A || !B) return null;
  if (aId === bId) return { term: 'chính mình', detail: 'Cùng một người.' };
  const ancA = ancestors(ctx, aId);
  const ancB = ancestors(ctx, bId);
  let best: { id: number; da: number; db: number } | null = null;
  for (const [id, a] of ancA) {
    const b = ancB.get(id);
    if (!b) continue;
    if (!best || a.depth + b.depth < best.da + best.db) best = { id, da: a.depth, db: b.depth };
  }
  if (!best) return null;
  const { da, db, id: lca } = best;
  const L = ctx.byId.get(lca)!;
  const male = B.gender === 'male';
  // Bên nội / ngoại: theo bước đầu tiên A đi lên
  const firstUp = ancA.get(lca)!.path[0];
  const side = firstUp && firstUp === A.mother_id ? 'ngoại' : 'nội';
  // Hai nhánh con của tổ chung để so vai
  const branchA = da > 0 ? ctx.byId.get(ancA.get(lca)!.path.length > 1 ? ancA.get(lca)!.path[da - 2] : aId) : undefined;
  const branchB = db > 0 ? ctx.byId.get(ancB.get(lca)!.path.length > 1 ? ancB.get(lca)!.path[db - 2] : bId) : undefined;
  const bSenior = branchA && branchB ? isSenior(branchB, branchA) : false;
  const lcaName = L.full_name;

  // B là tổ tiên trực hệ của A
  if (db === 0) {
    let t = (male ? ASC_M : ASC_F)[da] ?? `tổ đời thứ ${da}`;
    if (da === 2) t += ` ${side}`;
    return { term: t, detail: `${B.full_name} là tổ tiên trực hệ, trên ${da} đời.`, ancestorId: lca };
  }
  // B là con cháu trực hệ của A
  if (da === 0) {
    const t = DESC[db] ?? `cháu đời thứ ${db}`;
    return { term: t, detail: `${B.full_name} là hậu duệ trực hệ, dưới ${db} đời.`, ancestorId: lca };
  }
  const gap = da - db; // >0: B ở vai trên
  const cousin = da > 1 || db > 1; // không phải anh em ruột / cô dì chú bác ruột
  const ho = cousin && !(da === 2 && db === 1) && !(da === 1 && db === 2) ? ' họ' : '';
  let term: string;
  if (gap === 0) {
    term = bSenior ? (male ? 'anh' : 'chị') : 'em';
    if (da > 1) term += ' họ';
  } else if (gap === 1) {
    if (bSenior) term = 'bác';
    else if (side === 'nội') term = male ? 'chú' : 'cô';
    else term = male ? 'cậu' : 'dì';
    term += ho;
  } else if (gap === -1) {
    term = 'cháu' + ho;
  } else if (gap === 2) {
    term = (male ? 'ông' : 'bà') + ' họ';
  } else if (gap === 3) {
    term = (male ? 'cụ ông' : 'cụ bà') + ' họ';
  } else if (gap === 4) {
    term = (male ? 'kỵ ông' : 'kỵ bà') + ' họ';
  } else if (gap > 4) {
    term = `tổ họ (trên ${gap} đời)`;
  } else {
    term = (DESC[-gap] ?? `cháu đời thứ ${-gap}`) + ' họ';
  }
  return {
    term,
    detail: `Tổ chung gần nhất: ${lcaName}. ${A.full_name} cách ${da} đời, ${B.full_name} cách ${db} đời. ${
      gap === 0 ? '' : bSenior ? 'Nhánh của B là nhánh trên.' : 'Nhánh của A là nhánh trên.'
    }`.trim(),
    ancestorId: lca,
  };
}

const SPOUSE_OF: Record<string, [string, string]> = {
  // term của người ruột -> [cách gọi vợ của họ, cách gọi chồng của họ]
  con: ['con dâu', 'con rể'],
  anh: ['chị dâu', 'chị dâu'],
  chị: ['anh rể', 'anh rể'],
  em: ['em dâu', 'em rể'],
  bác: ['bác gái', 'bác trai'],
  chú: ['thím', 'thím'],
  cô: ['chú (dượng)', 'chú (dượng)'],
  cậu: ['mợ', 'mợ'],
  dì: ['chú (dượng)', 'chú (dượng)'],
  cháu: ['cháu dâu', 'cháu rể'],
};

export function kinship(ctx: Ctx, aId: number, bId: number): KinshipResult {
  const A = ctx.byId.get(aId);
  const B = ctx.byId.get(bId);
  if (!A || !B) return { term: 'không xác định', detail: 'Không tìm thấy thành viên.' };

  const direct = bloodRelation(ctx, aId, bId);
  if (direct) return direct;

  if ((ctx.spouses.get(aId) ?? []).includes(bId)) {
    return { term: B.gender === 'male' ? 'chồng' : 'vợ', detail: 'Quan hệ hôn nhân.' };
  }
  // B là vợ/chồng của một người ruột R của A
  for (const r of ctx.spouses.get(bId) ?? []) {
    const rel = bloodRelation(ctx, aId, r);
    if (!rel) continue;
    const R = ctx.byId.get(r)!;
    const base = rel.term.replace(/ (họ|nội|ngoại)$/, '');
    const suffix = rel.term.endsWith(' họ') ? ' họ' : '';
    const map = SPOUSE_OF[base];
    let term: string;
    if (map) term = map[B.gender === 'female' ? 0 : 1] + suffix;
    else if (base.startsWith('ông')) term = 'bà' + rel.term.slice(3);
    else if (base.startsWith('bà')) term = 'ông' + rel.term.slice(2);
    else if (base === 'bố') term = 'mẹ (kế)';
    else if (base === 'mẹ') term = 'bố (dượng)';
    else term = `${B.gender === 'female' ? 'vợ' : 'chồng'} của ${rel.term}`;
    return { term, detail: `${B.full_name} là ${B.gender === 'female' ? 'vợ' : 'chồng'} của ${R.full_name} (${rel.term} của ${A.full_name}).` };
  }
  // A là dâu/rể: tính theo vợ/chồng của A
  for (const s of ctx.spouses.get(aId) ?? []) {
    const rel = bloodRelation(ctx, s, bId);
    if (!rel) continue;
    const S = ctx.byId.get(s)!;
    const ben = S.gender === 'male' ? 'chồng' : 'vợ';
    let term = rel.term;
    if (rel.term === 'bố') term = `bố ${ben}`;
    else if (rel.term === 'mẹ') term = `mẹ ${ben}`;
    else term = `${rel.term} (bên ${ben})`;
    return { term, detail: `Tính theo ${S.full_name}: ${S.full_name} gọi ${B.full_name} là ${rel.term}.` };
  }
  return { term: 'chưa xác định', detail: 'Không tìm thấy tổ chung trong dữ liệu hiện có.' };
}
