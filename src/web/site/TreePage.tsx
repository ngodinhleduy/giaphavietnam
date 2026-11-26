import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../lib/api.ts';
import type { Marriage, MemberBrief } from '../lib/types.ts';
import { lifespan } from '../lib/format.ts';
import { fold } from '../../shared/slug.ts';
import { Container, useSite } from './SiteLayout.tsx';
import { FamilyTree, TreeControls, useTreeModel, type FamilyTreeHandle, type TreeOptions } from '../components/FamilyTree.tsx';
import {
  Avatar, Badge, Button, Checkbox, PasswordInput, rankByName, SearchInput, EmptyState, ErrorState, Field, Input, Loading, MemberPicker, PageHeader, Select, cx, useFullscreen,
} from '../components/ui.tsx';

type TreeData = { members: MemberBrief[]; marriages: Marriage[] };

export function TreePage() {
  const { site, reload: reloadSite } = useSite();
  const tree = useApi<TreeData>('/tree');

  if (tree.loading) return <Loading label="Đang tải phả đồ..." />;
  if (tree.error?.locked || (tree.error?.status === 401))
    return <Gate onUnlocked={() => { tree.reload(); reloadSite(); }} />;
  if (tree.error) return <Container className="py-10"><ErrorState error={tree.error} onRetry={tree.reload} /></Container>;
  if (!tree.data?.members.length)
    return (
      <Container className="py-10">
        <PageHeader title="Phả đồ dòng họ" />
        <EmptyState title="Chưa có thành viên nào" text="Ban quản trị cần nhập thủy tổ và các đời tiếp theo trong trang quản trị." />
      </Container>
    );
  return <TreeView data={tree.data} locked={site.locked} onLock={async () => { await api.post('/viewer/lock'); tree.reload(); reloadSite(); }} />;
}

function Gate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.post('/viewer/unlock', { passcode: code });
      onUnlocked();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Container className="py-16 sm:py-24">
      <form onSubmit={submit} className="max-w-sm mx-auto rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm">
        <div className="size-12 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <h1 className="mt-4 font-serif text-2xl font-semibold">Phả đồ dòng họ</h1>
        <p className="mt-2 text-ink-2">Phả đồ chỉ dành cho con cháu trong họ. Nhập mã bảo mật do ban liên lạc cung cấp.</p>
        <Field label="Mã bảo mật" htmlFor="pc" error={err} className="mt-6">
          <PasswordInput id="pc" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} autoFocus
            aria-invalid={!!err} />
        </Field>
        <Button type="submit" variant="primary" className="w-full mt-5" loading={busy} disabled={!code}>Xem phả đồ</Button>
      </form>
    </Container>
  );
}

function TreeView({ data, locked, onLock }: { data: TreeData; locked: boolean; onLock: () => void }) {
  const { site } = useSite();
  const model = useTreeModel(data.members, data.marriages);
  const ref = useRef<FamilyTreeHandle>(null);
  const fs = useFullscreen(() => ref.current?.fit());
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'tree';
  const maxGenAll = Math.max(1, ...data.members.map((m) => m.generation ?? 1));
  const [opt, setOpt] = useState<TreeOptions>({
    hideSpouses: false, coupleLines: true, maxGen: null, collapsed: new Set(), rootId: null,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [showOpts, setShowOpts] = useState(false);
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    return fold(q).length < 2 ? [] : rankByName(data.members, q);
  }, [q, data.members]);
  const highlight = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);
  const sel = selected ? model.byId.get(selected) ?? null : null;

  // Khi tìm: mở các nhánh chứa kết quả rồi đưa vào giữa màn hình
  const revealAndCenter = (id: number) => {
    const chain: number[] = [];
    let cur = model.byId.get(id);
    while (cur) {
      const p = model.primaryParent(cur);
      if (p == null) break;
      chain.push(p);
      cur = model.byId.get(p);
    }
    const target = model.spouseOnly.has(id) ? (model.spouses.get(id) ?? [])[0] ?? id : id;
    setOpt((o) => {
      const collapsed = new Set(o.collapsed);
      chain.forEach((c) => collapsed.delete(c));
      const g = model.byId.get(target)?.generation ?? 1;
      return { ...o, collapsed, maxGen: o.maxGen && o.maxGen < g ? null : o.maxGen, rootId: o.rootId && !chain.includes(o.rootId) && o.rootId !== target ? null : o.rootId };
    });
    setSelected(id);
    setTimeout(() => ref.current?.centerOn(target), 80);
  };

  // /pha-do?focus=ID: mở thẳng tới một người (đi từ trang hồ sơ)
  useEffect(() => {
    const f = Number(params.get('focus'));
    if (f && model.byId.has(f)) setTimeout(() => revealAndCenter(f), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="flex flex-col">
      <Container size="wide" className="pt-6 sm:pt-8 pb-2 sm:pb-4 no-print">
        <PageHeader title="Phả đồ dòng họ" subtitle={`${data.members.length} thành viên · ${maxGenAll} đời`}
          actions={locked ? <Button variant="ghost" size="sm" onClick={onLock}>Khóa lại</Button> : undefined} />
        <div role="tablist" className="flex gap-1 border-b border-line -mb-px overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
          {([['tree', 'Cây phả hệ'], ['list', 'Danh sách'], ['gen', 'Theo đời'], ['kin', 'Quan hệ xưng hô']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k}
              onClick={() => setParams((p) => { p.set('tab', k); return p; }, { replace: true })}
              className={cx('h-11 px-3 sm:px-4 text-[15px] font-medium border-b-2 whitespace-nowrap cursor-pointer shrink-0',
                tab === k ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink')}>
              {l}
            </button>
          ))}
        </div>
      </Container>

      {tab === 'tree' && (
        <Container size="wide" className="pb-6">
          <div className="flex flex-wrap items-center gap-2 py-3 no-print">
            <div className="relative flex-1 min-w-0 md:flex-none md:w-72">
              <SearchInput placeholder="Tìm tên, không cần dấu" value={q} onChange={setQ}
                aria-label="Tìm thành viên" onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { revealAndCenter(matches[0].id); setQ(''); } if (e.key === 'Escape') setQ(''); }} />
              {q.length >= 2 && (
                <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-line bg-surface shadow-lg py-1">
                  {!matches.length && <li className="px-3 py-2 text-sm text-ink-3">Không tìm thấy</li>}
                  {matches.slice(0, 20).map((m) => (
                    <li key={m.id}>
                      <button className="w-full text-left flex items-center gap-2 px-3 py-2 min-h-11 hover:bg-sunken cursor-pointer"
                        onClick={() => { revealAndCenter(m.id); setQ(''); }}>
                        <Avatar m={m} size={26} />
                        <span className="flex-1 truncate">{m.full_name}</span>
                        <span className="text-xs text-ink-3">Đời {m.generation}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button className="md:hidden" aria-expanded={showOpts} aria-controls="tree-opts" onClick={() => setShowOpts((v) => !v)}
              icon={<svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h14M6 10h8M8 14h4" /></svg>}>
              Tùy chọn
            </Button>
            <div id="tree-opts" className={cx('w-full md:w-auto md:contents', showOpts ? 'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface p-3' : 'hidden')}>
            <Select aria-label="Hiển thị đến đời" className="w-full sm:w-auto" value={opt.maxGen ?? ''}
              onChange={(e) => setOpt((o) => ({ ...o, maxGen: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">Tất cả các đời</option>
              {Array.from({ length: maxGenAll }, (_, i) => i + 1).map((g) => <option key={g} value={g}>Đến đời {g}</option>)}
            </Select>
            <Checkbox label="Ẩn vợ/chồng" checked={opt.hideSpouses} onChange={(v) => setOpt((o) => ({ ...o, hideSpouses: v }))} />
            <Checkbox label="Nối con theo cặp vợ chồng" checked={opt.coupleLines} onChange={(v) => setOpt((o) => ({ ...o, coupleLines: v }))} />
            <div className="w-full md:w-auto md:ml-auto flex gap-2 pt-2 md:pt-0">
              <ExportMenu onPng={async () => { const b = await ref.current?.exportPng(); if (b) download(b, 'pha-do.png'); }}
                onSvg={() => { const s = ref.current?.exportSvg(); if (s) download(new Blob([s], { type: 'image/svg+xml' }), 'pha-do.svg'); }} />
            </div>
            </div>
          </div>

          <div className={cx('relative h-[calc(100dvh-18.5rem)] min-h-[400px] md:h-[72vh] md:min-h-[520px] 2xl:h-[78vh] -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-line bg-[radial-gradient(circle,#e5e0d8_1px,transparent_1px)] [background-size:20px_20px] overflow-hidden', fs.className)}>
            <FamilyTree ref={ref} model={model} options={opt} lines={site.tree_lines} selectedId={selected} highlight={highlight}
              onSelect={setSelected}
              onToggle={(id) => setOpt((o) => {
                const c = new Set(o.collapsed);
                const m = model.byId.get(id);
                const cappedByGen = o.maxGen && (m?.generation ?? 1) >= o.maxGen;
                if (cappedByGen) return { ...o, maxGen: null, collapsed: c };
                c.has(id) ? c.delete(id) : c.add(id);
                return { ...o, collapsed: c };
              })} />
            <TreeControls onZoom={(k) => ref.current?.zoomBy(k)} onFit={() => ref.current?.fit()} fs={fs} />
            {opt.rootId && (
              <div className="absolute left-16 right-3 sm:right-auto top-3 flex items-center gap-2 rounded-lg bg-surface border border-line pl-3 pr-1 min-h-10 text-sm no-print">
                <span className="flex-1 min-w-0 truncate">Hậu duệ của <b>{model.byId.get(opt.rootId)?.full_name}</b></span>
                <Button size="sm" variant="ghost" onClick={() => setOpt((o) => ({ ...o, rootId: null }))}>Về gốc</Button>
              </div>
            )}
            {!sel && <Legend />}
            {sel && (
              <MemberPanel m={sel} onClose={() => setSelected(null)}
                onDescendants={() => { setOpt((o) => ({ ...o, rootId: model.spouseOnly.has(sel.id) ? (model.spouses.get(sel.id)?.[0] ?? sel.id) : sel.id, collapsed: new Set() })); }}
                childrenCount={(model.children.get(sel.id) ?? []).length} />
            )}
          </div>
          <details className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-ink-2 no-print">
            <summary className="font-medium text-ink cursor-pointer">Hướng dẫn xem phả đồ</summary>
            <ul className="mt-3 space-y-1.5 list-disc pl-5">
              <li>Kéo, lăn chuột hoặc vuốt hai ngón trên trackpad để di chuyển. Chụm hai ngón, hoặc giữ Ctrl (Cmd trên Mac) khi lăn chuột, để phóng to, thu nhỏ.</li>
              <li>Nút mũi tên ở góc trên trái mở phả đồ toàn màn hình. Nhấn Esc để thoát.</li>
              <li>Bấm vào một người để xem thông tin. Nút <b>−</b> dưới thẻ thu gọn nhánh, nút <b>+n</b> mở lại.</li>
              <li>Thẻ viền nét đứt là dâu hoặc rể. Thẻ nền xám là người đã mất.</li>
              <li>Tìm tên không cần gõ dấu. Nhấn Enter để nhảy tới kết quả đầu tiên.</li>
            </ul>
          </details>
          <div className="mt-6 rounded-xl border border-line bg-accent-soft/50 p-5 flex flex-wrap items-center justify-between gap-3 no-print">
            <div>
              <p className="font-medium text-ink">Phát hiện thiếu sót trong phả đồ?</p>
              <p className="text-sm text-ink-2">Gửi thông tin bổ sung cho ban liên lạc để cập nhật.</p>
            </div>
            <a href="/api/export/members.csv" className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium text-ink hover:bg-sunken">
              Tải danh sách (Excel)
            </a>
          </div>
        </Container>
      )}

      {tab === 'list' && <MemberGrid members={data.members} maxGen={maxGenAll} />}
      {tab === 'gen' && <ByGeneration members={data.members} maxGen={maxGenAll} />}
      {tab === 'kin' && <KinshipTool members={data.members} />}
    </div>
  );
}

function ExportMenu({ onPng, onSvg }: { onPng: () => void; onSvg: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => window.addEventListener('click', close, { once: true }));
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>Xuất phả đồ</Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-line bg-surface shadow-lg py-1">
          {[['Ảnh PNG (không kèm ảnh chân dung)', onPng], ['Vector SVG (in khổ lớn, không kèm ảnh)', onSvg], ['In / Lưu PDF', () => window.print()]].map(([l, f]) => (
            <button key={l as string} onClick={f as () => void} className="w-full text-left px-3 py-2.5 text-sm hover:bg-sunken cursor-pointer">{l as string}</button>
          ))}
          <a href="/api/export/members.csv" className="block px-3 py-2.5 text-sm hover:bg-sunken">Danh sách Excel (CSV)</a>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute left-3 right-3 sm:right-auto bottom-3 rounded-lg bg-surface/95 border border-line px-3 py-2 text-xs text-ink-2 flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 no-print">
      <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-surface border border-line-strong" />Trong họ</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-sunken border border-line-strong" />Dâu / rể</span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-3 bg-[#f3eee4] border-2 border-[#141414]" />Còn sống</span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-3 bg-[#e4e3df] border-2 border-[#141414]" />Đã mất</span>
    </div>
  );
}

function MemberPanel({ m, onClose, onDescendants, childrenCount }: {
  m: MemberBrief; onClose: () => void; onDescendants: () => void; childrenCount: number;
}) {
  return (
    <aside className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:w-80 rounded-t-2xl sm:rounded-xl border border-line bg-surface shadow-[0_-8px_24px_rgba(0,0,0,.08)] sm:shadow-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] no-print"
      aria-label={`Thông tin ${m.full_name}`}>
      <div className="flex gap-3">
        <Avatar m={m} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink leading-snug">{m.full_name}</p>
          {m.alias && <p className="text-sm text-ink-2">{m.alias}</p>}
          <p className="text-sm text-ink-2 mt-0.5">{lifespan(m)}</p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="size-10 -mr-2 -mt-2 rounded-lg text-xl text-ink-3 hover:bg-sunken hover:text-ink cursor-pointer">×</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.generation && <Badge tone="accent">Đời {m.generation}</Badge>}
        {!m.is_blood && <Badge>{m.gender === 'female' ? 'Con dâu' : 'Con rể'}</Badge>}
        {m.branch && <Badge tone="gold">{m.branch}</Badge>}
        {childrenCount > 0 && <Badge>{childrenCount} người con</Badge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to={`/thanh-vien/${m.id}`} className="h-10 pointer-coarse:h-11 inline-flex items-center justify-center rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover">
          Xem hồ sơ
        </Link>
        <Button className="text-sm" onClick={onDescendants}>Chỉ xem hậu duệ</Button>
      </div>
    </aside>
  );
}

function MemberGrid({ members, maxGen }: { members: MemberBrief[]; maxGen: number }) {
  const [q, setQ] = useState('');
  const [gen, setGen] = useState('');
  const [kind, setKind] = useState('');
  const list = useMemo(() => {
    const f = fold(q);
    return members.filter((m) =>
      (!f || fold(m.full_name).includes(f) || fold(m.alias ?? '').includes(f)) &&
      (!gen || m.generation === Number(gen)) &&
      (!kind || (kind === 'blood' ? m.is_blood : kind === 'inlaw' ? !m.is_blood : kind === 'dead' ? m.is_deceased : !m.is_deceased)),
    );
  }, [members, q, gen, kind]);
  return (
    <Container size="wide" className="py-6">
      <div className="flex flex-wrap gap-2 mb-5">
        <SearchInput className="w-full sm:w-72" placeholder="Tìm tên" value={q} onChange={setQ} aria-label="Tìm tên" />
        <Select className="flex-1 sm:flex-none w-auto" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="Lọc theo đời">
          <option value="">Mọi đời</option>
          {Array.from({ length: maxGen }, (_, i) => <option key={i} value={i + 1}>Đời {i + 1}</option>)}
        </Select>
        <Select className="flex-1 sm:flex-none w-auto" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Lọc loại">
          <option value="">Tất cả</option>
          <option value="blood">Huyết thống</option>
          <option value="inlaw">Dâu / rể</option>
          <option value="alive">Còn sống</option>
          <option value="dead">Đã mất</option>
        </Select>
        <span className="self-center text-sm text-ink-3 sm:ml-auto">{list.length} người</span>
      </div>
      {!list.length ? <EmptyState title="Không tìm thấy thành viên phù hợp" text="Thử bỏ bớt bộ lọc hoặc gõ tên ngắn hơn." /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {list.map((m) => (
            <li key={m.id}>
              <Link to={`/thanh-vien/${m.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-line-strong hover:shadow-sm">
                <Avatar m={m} size={48} />
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{m.full_name}</p>
                  <p className="text-sm text-ink-2">Đời {m.generation}{lifespan(m) ? ` · ${lifespan(m)}` : ''}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

function ByGeneration({ members, maxGen }: { members: MemberBrief[]; maxGen: number }) {
  const groups = Array.from({ length: maxGen }, (_, i) => members.filter((m) => (m.generation ?? 1) === i + 1));
  return (
    <Container size="wide" className="py-6 space-y-3">
      {groups.map((g, i) => (
        <details key={i} open={i < 2} className="group rounded-xl border border-line bg-surface">
          <summary className="flex flex-wrap items-center justify-between gap-x-4 px-4 sm:px-5 py-3 min-h-14 cursor-pointer list-none">
            <span className="font-serif text-lg font-semibold">Đời thứ {i + 1}</span>
            <span className="text-sm text-ink-2">{g.filter((m) => m.is_blood).length} huyết thống · {g.filter((m) => !m.is_blood).length} dâu/rể</span>
          </summary>
          <ul className="border-t border-line divide-y divide-line lg:divide-y-0 lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:gap-x-2 lg:p-2">
            {g.map((m) => (
              <li key={m.id}>
                <Link to={`/thanh-vien/${m.id}`} className="flex items-center gap-3 px-4 sm:px-5 lg:px-3 py-2.5 min-h-12 lg:rounded-lg hover:bg-sunken">
                  <Avatar m={m} size={32} />
                  <span className="flex-1">{m.full_name}{!m.is_blood && <span className="text-ink-3 text-sm"> ({m.gender === 'female' ? 'dâu' : 'rể'})</span>}</span>
                  <span className="text-sm text-ink-2 whitespace-nowrap">{lifespan(m)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </Container>
  );
}

type KinResult = { term: string; detail: string };
function KinshipTool({ members }: { members: MemberBrief[] }) {
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [res, setRes] = useState<{ a_calls_b: KinResult; b_calls_a: KinResult } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const A = members.find((m) => m.id === a);
  const B = members.find((m) => m.id === b);
  useEffect(() => {
    setRes(null);
    if (!a || !b) return;
    setBusy(true);
    setErr('');
    api.get<{ a_calls_b: KinResult; b_calls_a: KinResult }>(`/kinship?a=${a}&b=${b}`)
      .then(setRes).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  }, [a, b]);
  return (
    <Container size="text" className="py-6">
      <p className="text-ink-2 mb-5">Chọn hai người để xem họ gọi nhau thế nào. Cách gọi theo miền Bắc, tính vai theo thứ bậc chi trên chi dưới.</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-end">
        <Field label="Người thứ nhất" htmlFor="ka"><MemberPicker id="ka" members={members} value={a} onChange={setA} /></Field>
        <Button variant="ghost" aria-label="Đổi chỗ hai người" onClick={() => { setA(b); setB(a); }} className="justify-self-center rotate-90 sm:rotate-0">⇄</Button>
        <Field label="Người thứ hai" htmlFor="kb"><MemberPicker id="kb" members={members} value={b} onChange={setB} /></Field>
      </div>
      <div className="mt-6" aria-live="polite">
        {busy && <Loading label="Đang tính..." />}
        {err && <ErrorState error={err} />}
        {res && A && B && (
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-ink-2">{A.full_name} gọi {B.full_name} là</p>
                <p className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-accent break-words">{res.a_calls_b.term}</p>
              </div>
              <div>
                <p className="text-sm text-ink-2">{B.full_name} gọi {A.full_name} là</p>
                <p className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-accent break-words">{res.b_calls_a.term}</p>
              </div>
            </div>
            <p className="mt-5 pt-4 border-t border-line text-sm text-ink-2">{res.a_calls_b.detail}</p>
          </div>
        )}
        {!a || !b ? <p className="text-sm text-ink-3">Chưa chọn đủ hai người.</p> : null}
      </div>
    </Container>
  );
}
