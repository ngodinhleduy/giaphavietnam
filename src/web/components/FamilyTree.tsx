import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { Marriage, MemberBrief } from '../lib/types.ts';
import { fileUrl } from '../lib/api.ts';
import { initials, year } from '../lib/format.ts';
import { Minus, Plus, Scan } from 'lucide-react';
import { FullscreenButton } from './ui.tsx';

const CW = 190;
const CH = 76;
const SPOUSE_GAP = 14;
const GAP_X = 22;
const ROW_H = CH + 74;
/** Bề rộng cột đời cố định ở mép trái khung phả đồ */
const GEN_W = 56;
/** Màu thẻ của người đã mất, dùng chung cho cây và phần chú thích */
export const DEAD = { card: '#e3ddd1', line: '#b3aa9b', frame: '#b9b1a3' };

export type TreeOptions = {
  hideSpouses: boolean;
  coupleLines: boolean; // nối con từ điểm giữa vợ chồng thay vì từ cha/mẹ
  maxGen: number | null;
  collapsed: Set<number>;
  rootId: number | null;
};

type Node = { m: MemberBrief; x: number; y: number; spouse: boolean; hiddenKids: number; hasKids: boolean };
type Link = { d: string; key: string };

export function useTreeModel(members: MemberBrief[], marriages: Marriage[]) {
  return useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const spouses = new Map<number, number[]>();
    for (const mr of [...marriages].sort((a, b) => a.order_no - b.order_no)) {
      if (!byId.has(mr.husband_id) || !byId.has(mr.wife_id)) continue;
      spouses.set(mr.husband_id, [...(spouses.get(mr.husband_id) ?? []), mr.wife_id]);
      spouses.set(mr.wife_id, [...(spouses.get(mr.wife_id) ?? []), mr.husband_id]);
    }
    const spouseOnly = new Set(
      members
        .filter((m) => !m.is_blood && !byId.has(m.father_id ?? -1) && !byId.has(m.mother_id ?? -1) && spouses.get(m.id)?.length)
        .map((m) => m.id),
    );
    const primaryParent = (m: MemberBrief): number | null => {
      const f = m.father_id && byId.get(m.father_id);
      const mo = m.mother_id && byId.get(m.mother_id);
      if (f && !spouseOnly.has(f.id)) return f.id;
      if (mo && !spouseOnly.has(mo.id)) return mo.id;
      return (f || mo || null)?.id ?? null;
    };
    const yr = (m: MemberBrief) => (m.birth_date ? parseInt(m.birth_date, 10) : 9999);
    const children = new Map<number, MemberBrief[]>();
    for (const m of members) {
      const p = primaryParent(m);
      if (p != null && !spouseOnly.has(m.id)) children.set(p, [...(children.get(p) ?? []), m]);
    }
    for (const list of children.values())
      list.sort((a, b) => (a.birth_order ?? 99) - (b.birth_order ?? 99) || yr(a) - yr(b) || a.id - b.id);
    const roots = members
      .filter((m) => !spouseOnly.has(m.id) && primaryParent(m) == null)
      .sort((a, b) => (a.generation ?? 1) - (b.generation ?? 1) || a.id - b.id);
    return { byId, spouses, spouseOnly, children, roots, primaryParent };
  }, [members, marriages]);
}

export type TreeModel = ReturnType<typeof useTreeModel>;

export type TreeLines = 'ortho' | 'curve' | 'straight';
function layout(model: TreeModel, opt: TreeOptions, lines: TreeLines = 'ortho') {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const width = new Map<number, number>();
  const visibleKids = (id: number) => {
    const m = model.byId.get(id)!;
    if (opt.collapsed.has(id)) return [];
    if (opt.maxGen && (m.generation ?? 1) >= opt.maxGen) return [];
    return model.children.get(id) ?? [];
  };
  const shownSpouses = (id: number) =>
    opt.hideSpouses ? [] : (model.spouses.get(id) ?? []).filter((s) => model.spouseOnly.has(s));
  const unitW = (id: number) => CW + shownSpouses(id).length * (CW + SPOUSE_GAP);

  const measure = (id: number): number => {
    const kids = visibleKids(id);
    const kw = kids.reduce((s, k) => s + measure(k.id), 0) + Math.max(0, kids.length - 1) * GAP_X;
    const w = Math.max(unitW(id), kw);
    width.set(id, w);
    return w;
  };

  const place = (id: number, left: number, y: number) => {
    const m = model.byId.get(id)!;
    const w = width.get(id)!;
    const uw = unitW(id);
    const ux = left + (w - uw) / 2;
    const all = model.children.get(id) ?? [];
    const kids = visibleKids(id);
    nodes.push({ m, x: ux, y, spouse: false, hiddenKids: all.length - kids.length, hasKids: all.length > 0 });
    const sp = shownSpouses(id);
    sp.forEach((sid, i) => {
      const sx = ux + (i + 1) * (CW + SPOUSE_GAP);
      nodes.push({ m: model.byId.get(sid)!, x: sx, y, spouse: true, hiddenKids: 0, hasKids: false });
      links.push({ key: `mr${id}-${sid}`, d: `M${sx - SPOUSE_GAP},${y + CH / 2}H${sx}` });
    });
    const kw = kids.reduce((s, k) => s + width.get(k.id)!, 0) + Math.max(0, kids.length - 1) * GAP_X;
    let cx = left + (w - kw) / 2;
    const yb = y + CH;
    const midY = yb + (ROW_H - CH) / 2;
    for (const k of kids) {
      const kw2 = width.get(k.id)!;
      const childUnit = unitW(k.id);
      const childX = cx + (kw2 - childUnit) / 2 + CW / 2;
      let ax = ux + CW / 2;
      if (opt.coupleLines) {
        const other = k.father_id === id ? k.mother_id : k.father_id;
        const si = other != null ? sp.indexOf(other) : -1;
        if (si >= 0) ax = ux + (si + 1) * (CW + SPOUSE_GAP) - SPOUSE_GAP / 2;
      }
      // Kiểu đường nối cha con: góc vuông, cong mềm, hoặc chéo thẳng
      const yc = y + ROW_H;
      links.push({ key: `p${id}-${k.id}`, d: lines === 'curve' ? `M${ax},${yb}C${ax},${midY + 6} ${childX},${midY - 6} ${childX},${yc}`
        : lines === 'straight' ? `M${ax},${yb}L${childX},${yc}` : `M${ax},${yb}V${midY}H${childX}V${yc}` });
      place(k.id, cx, y + ROW_H);
      cx += kw2 + GAP_X;
    }
  };

  const roots = opt.rootId && model.byId.has(opt.rootId) ? [model.byId.get(opt.rootId)!] : model.roots;
  let left = 0;
  for (const r of roots) {
    measure(r.id);
    const g0 = opt.rootId ? 0 : ((r.generation ?? 1) - 1) * ROW_H;
    place(r.id, left, g0);
    left += width.get(r.id)! + GAP_X * 3;
  }
  // Đảm bảo hàng (đời) thẳng nhau khi có nhiều gốc ở các đời khác nhau
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const bounds = nodes.length
    ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + CW, y1: Math.max(...ys) + CH + 24 }
    : { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { nodes, links, bounds };
}

function wrapName(name: string, max = 17): string[] {
  if (name.length <= max) return [name];
  const words = name.split(/\s+/);
  const lines: string[] = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length <= max) lines[lines.length - 1] = (cur + ' ' + w).trim();
    else lines.push(w);
  }
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ').slice(0, max - 1) + '…'];
  return lines;
}

export type FamilyTreeHandle = {
  fit: () => void;
  centerOn: (id: number) => void;
  zoomBy: (k: number) => void;
  exportSvg: () => string;
  exportPng: () => Promise<Blob | null>;
};

export const FamilyTree = forwardRef<FamilyTreeHandle, {
  model: TreeModel;
  options: TreeOptions;
  selectedId: number | null;
  highlight: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  showPhotos?: boolean;
  /** Kiểu đường nối, lấy từ Cấu hình website > Hiển thị */
  lines?: string;
}>(function FamilyTree({ model, options, selectedId, highlight, onSelect, onToggle, showPhotos = true, lines }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const { nodes, links, bounds } = useMemo(() => layout(model, options, lines === 'curve' || lines === 'straight' ? lines : 'ortho'), [model, options, lines]);
  // Mỗi đời một hàng: nhãn "Đời n" ở lề trái và nền xen kẽ để dễ dò
  const rows = useMemo(() => {
    const m = new Map<number, number>();
    for (const n of nodes) if (!n.spouse && n.m.generation && !m.has(n.y)) m.set(n.y, n.m.generation);
    return [...m].map(([y, gen]) => ({ y, gen })).sort((a, b) => a.y - b.y);
  }, [nodes]);
  const pos = useMemo(() => new Map(nodes.filter((n) => !n.spouse || !nodes.some((o) => o.m.id === n.m.id && !o.spouse)).map((n) => [n.m.id, n])), [nodes]);

  useEffect(() => {
    const svg = select(svgRef.current!);
    // Quy ước như Figma: lăn chuột hoặc vuốt hai ngón là di chuyển; chụm hai ngón (trình duyệt báo wheel kèm ctrlKey)
    // hoặc giữ Ctrl/Cmd khi lăn là phóng to, thu nhỏ.
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 2.5])
      .filter((e: any) => (e.type === 'wheel' ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.button))
      // Chụm trackpad cho delta nhỏ, một nấc chuột cho delta 100: chặn trên để một nấc không phóng quá 25%
      .wheelDelta((e: any) => Math.max(-0.32, Math.min(0.32, -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.01))))
      .on('zoom', (e) => setT(e.transform));
    zoomRef.current = z;
    svg.call(z).on('dblclick.zoom', null);
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode ? el.clientHeight : 1;
      // Chuột thường chỉ có trục dọc: giữ Shift để đi ngang
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
      const k = zoomTransform(el).k;
      z.translateBy(svg, -dx / k, -dy / k);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      svg.on('.zoom', null);
    };
  }, []);

  const fit = () => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current || !nodes.length) return;
    const { width, height } = svg.getBoundingClientRect();
    const lead = rows.length ? GEN_W + 64 : 0; // chừa lề trái cho cột đời và cụm nút
    const bw = bounds.x1 - bounds.x0 + lead;
    const bh = bounds.y1 - bounds.y0;
    const kFit = Math.min(1, (width - 48) / bw, (height - 48) / bh);
    const k = Math.max(kFit, width < 640 ? 0.5 : 0.6);
    let tx = (width - bw * k) / 2 - (bounds.x0 - lead) * k;
    if (k > kFit) {
      // Cây lớn hơn khung: canh giữa theo gốc đầu tiên, neo lên trên
      const root = nodes.find((n) => !n.spouse);
      if (root) tx = width / 2 - (root.x + CW / 2) * k;
    }
    const ty = (k > kFit ? 24 : Math.max(24, (height - bh * k) / 2)) - bounds.y0 * k;
    select(svg).transition().duration(350).call(zoomRef.current.transform as any, zoomIdentity.translate(tx, ty).scale(k));
  };

  const centerOn = (id: number) => {
    const svg = svgRef.current;
    const n = pos.get(id);
    if (!svg || !n || !zoomRef.current) return;
    const { width, height } = svg.getBoundingClientRect();
    const k = Math.max(t.k, 0.8);
    select(svg)
      .transition()
      .duration(450)
      .call(zoomRef.current.transform as any, zoomIdentity.translate(width / 2 - (n.x + CW / 2) * k, height / 2 - (n.y + CH / 2) * k).scale(k));
  };

  // Fit khi đổi gốc / bộ lọc lớn
  const fitKey = `${options.rootId}|${options.maxGen}|${options.hideSpouses}|${model.roots.length}|${model.byId.size}`;
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const serialize = (withImages: boolean) => {
    const pad = 32;
    const lead = 64; // lề trái cho nhãn đời
    const w = bounds.x1 - bounds.x0 + pad * 2 + lead;
    const h = bounds.y1 - bounds.y0 + pad * 2;
    const clone = gRef.current!.cloneNode(true) as SVGGElement;
    clone.setAttribute('transform', `translate(${pad + lead - bounds.x0},${pad - bounds.y0})`);
    clone.querySelectorAll('[data-noexport]').forEach((el) => el.remove());
    clone.querySelectorAll('[data-exportonly]').forEach((el) => el.removeAttribute('display'));
    if (!withImages) clone.querySelectorAll('image').forEach((el) => el.remove());
    else clone.querySelectorAll('image').forEach((el) => el.setAttribute('href', location.origin + el.getAttribute('href')));
    const defs = svgRef.current!.querySelector('defs')!.outerHTML;
    return {
      w,
      h,
      text: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Be Vietnam Pro, Arial, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>${defs}${clone.outerHTML}</svg>`,
    };
  };

  useImperativeHandle(ref, () => ({
    fit,
    centerOn,
    zoomBy: (k) => zoomRef.current && select(svgRef.current!).transition().duration(200).call(zoomRef.current.scaleBy as any, k),
    exportSvg: () => serialize(false).text,
    exportPng: async () => {
      const { w, h, text } = serialize(false);
      const scale = Math.min(2, 16000 / Math.max(w, h));
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const ctx = c.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      return new Promise((r) => c.toBlob(r, 'image/png'));
    },
  }));

  return (
    <svg ref={svgRef} className="w-full h-full touch-none cursor-grab active:cursor-grabbing select-none" role="tree"
      aria-label="Cây phả hệ">
      <defs>
        <filter id="gp-gray"><feColorMatrix type="saturate" values="0" /></filter>
        <clipPath id="gp-avatar"><rect x="11" y="11" width="38" height="54" /></clipPath>
      </defs>
      <g ref={gRef} transform={t.toString()}>
        <g aria-hidden="true">
          {rows.map((r, i) => (
            <g key={r.y}>
              {i % 2 === 1 && <rect data-noexport x={bounds.x0 - 20000} y={r.y - (ROW_H - CH) / 2} width={bounds.x1 - bounds.x0 + 40000} height={ROW_H} fill="#f7f7f5" />}
              {/* Nhãn đời nằm trong cây chỉ dùng khi xuất ảnh. Trên màn hình đã có cột đời cố định ở mép trái. */}
              <text data-exportonly display="none" x={bounds.x0 - 28} y={r.y + CH / 2 + 4} textAnchor="end" fontSize="12" fontWeight="500" fill="#6b6a66">Đời {r.gen}</text>
            </g>
          ))}
        </g>
        <g fill="none" stroke="#8f8e8a" strokeWidth="1">
          {links.map((l) => <path key={l.key} d={l.d} />)}
        </g>
        {nodes.map((n) => {
          const m = n.m;
          const sel = selectedId === m.id;
          const hit = highlight.has(m.id);
          const lines = wrapName(m.full_name);
          const yrs = m.is_deceased ? `${year(m.birth_date) || '?'} – ${year(m.death_date) || '?'}` : year(m.birth_date) ? `Sinh ${year(m.birth_date)}` : '';
          return (
            <g key={`${n.spouse ? 's' : 'n'}${m.id}`} transform={`translate(${n.x},${n.y})`} role="treeitem"
              aria-label={`${m.full_name}${yrs ? ', ' + yrs : ''}`} aria-selected={sel} tabIndex={0}
              className="cursor-pointer outline-none"
              onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(m.id)}>
              {/* Người đã mất: cả thẻ ngả xám, khung ảnh xám đậm, ảnh đen trắng. Người còn sống: thẻ trắng, khung ảnh kem.
                  Khác nhau về độ sáng chứ không chỉ về màu, nên người mù màu vẫn phân biệt được; dòng năm cũng khác ("Sinh 1946" và "1820 – 1890"). */}
              <rect width={CW} height={CH} rx="6"
                fill={hit ? '#f3e2dc' : m.is_deceased ? DEAD.card : n.spouse ? '#faf6ef' : '#ffffff'}
                stroke={sel || hit ? '#a81e24' : m.is_hidden ? '#857a6d' : m.is_deceased ? DEAD.line : '#d8cfbf'}
                strokeWidth={sel ? 2 : 1} strokeDasharray={m.is_hidden ? '5 4' : undefined} />
              {showPhotos && m.photo_file_id ? (
                <image href={fileUrl(m.photo_file_id)} x="11" y="11" width="38" height="54" clipPath="url(#gp-avatar)"
                  preserveAspectRatio="xMidYMid slice" filter={m.is_deceased ? 'url(#gp-gray)' : undefined} />
              ) : (
                <>
                  <rect x="11" y="11" width="38" height="54" fill={m.is_deceased ? DEAD.frame : '#f3eee4'} />
                  <text x="30" y={CH / 2 + 7} textAnchor="middle" fontSize="19" fontWeight="500" fill={m.is_deceased ? '#3d3832' : '#201b17'}
                    fontFamily="Newsreader, Noto Serif, Georgia, serif">{initials(m.full_name).slice(-1)}</text>
                </>
              )}
              {/* Khung ảnh: viền đen mảnh, không hoa văn */}
              <rect x="11" y="11" width="38" height="54" fill="none" stroke={m.is_deceased ? '#5a554d' : '#141414'} strokeWidth="2.5" />
              <text x="60" y={lines.length > 1 ? 24 : 32} fontSize="13.5" fontWeight="600" fill={m.is_deceased ? '#3d3832' : '#201b17'}>
                {lines.map((l, i) => <tspan key={i} x="60" dy={i ? 17 : 0}>{l}</tspan>)}
              </text>
              <text x="60" y={lines.length > 1 ? 60 : 52} fontSize="12" fill={m.is_deceased ? '#4c443c' : '#6b6156'}>
                {yrs}{m.generation && !n.spouse ? `${yrs ? ' · ' : ''}Đời ${m.generation}` : ''}{n.spouse ? `${yrs ? ' · ' : ''}${m.gender === 'female' ? 'Vợ' : 'Chồng'}` : ''}
              </text>
              {n.hasKids && (
                <g data-noexport transform={`translate(${CW / 2 - 13},${CH - 4})`}
                  onClick={(e) => { e.stopPropagation(); onToggle(m.id); }} role="button"
                  aria-label={n.hiddenKids ? `Mở ${n.hiddenKids} người con` : 'Thu gọn nhánh'}>
                  <rect x="-10" y="-8" width="46" height="36" fill="transparent" />
                  <rect width="26" height="18" rx="4" fill={n.hiddenKids ? '#191919' : '#ffffff'} stroke="#8f8e8a" />
                  <text x="13" y="13" textAnchor="middle" fontSize="11" fontWeight="600" fill={n.hiddenKids ? '#fff' : '#6b6a66'}>
                    {n.hiddenKids ? `+${n.hiddenKids}` : '−'}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
      {/* Cột đời cố định ở mép trái: chỉ trượt theo chiều dọc và co giãn theo mức zoom, nên kéo cây sang ngang vẫn biết đang ở đời nào. */}
      {rows.length > 0 && (
        <g aria-hidden="true" pointerEvents="none">
          {rows.map((r, i) => {
            const y = t.applyY(r.y - (ROW_H - CH) / 2);
            const h = ROW_H * t.k;
            return (
              <g key={r.y}>
                <rect x="0" y={y} width={GEN_W} height={h} fill={i % 2 ? '#ece5d8' : '#f6f1e8'} />
                {h >= 14 && (
                  <text x={GEN_W / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={h < 34 ? 11 : 12.5} fontWeight="600" fill="#4c443c">
                    {h < 34 ? r.gen : `Đời ${r.gen}`}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={GEN_W} y1="-10" x2={GEN_W} y2="100000" stroke="#d3cab9" />
        </g>
      )}
    </svg>
  );
});

/** Cụm nút điều khiển đặt ở góc trên trái khung phả đồ: phóng to, thu nhỏ, vừa khung, toàn màn hình. */
export function TreeControls({ onZoom, onFit, fs }: { onZoom: (k: number) => void; onFit: () => void; fs: { on: boolean; toggle: () => void } }) {
  // Khung nhóm rộng 40px tính cả viền, bằng đúng nút toàn màn hình bên dưới
  const b = 'w-full h-10 inline-flex items-center justify-center text-ink cursor-pointer transition-colors hover:bg-accent-soft hover:text-accent';
  return (
    <div className="absolute left-[4.25rem] top-3 z-10 flex flex-col gap-2 no-print" onClick={(e) => e.stopPropagation()}>
      <div className="w-10 flex flex-col rounded-lg border border-line-strong bg-surface shadow-sm overflow-hidden divide-y divide-line">
        <button type="button" className={b} aria-label="Phóng to" title="Phóng to" onClick={() => onZoom(1.3)}><Plus aria-hidden className="size-[18px]" /></button>
        <button type="button" className={b} aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => onZoom(1 / 1.3)}><Minus aria-hidden className="size-[18px]" /></button>
        <button type="button" className={b} aria-label="Vừa khung" title="Vừa khung" onClick={onFit}><Scan aria-hidden className="size-[18px]" /></button>
      </div>
      <FullscreenButton on={fs.on} onClick={fs.toggle} />
    </div>
  );
}
