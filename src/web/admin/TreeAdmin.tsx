import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../lib/api.ts';
import type { Gender, Marriage, MemberBrief } from '../lib/types.ts';
import { lifespan } from '../lib/format.ts';
import { FamilyTree, useTreeModel, type FamilyTreeHandle, type TreeOptions } from '../components/FamilyTree.tsx';
import {
  Avatar, Badge, Button, Checkbox, ErrorState, Field, Input, Loading, Modal, SearchInput, Segmented, Select, rankByName, useToast,
} from '../components/ui.tsx';

type TreeData = { members: MemberBrief[]; marriages: Marriage[] };
type Undo = { text: string; run: () => Promise<void> };
type Dialog = { kind: 'child' | 'spouse' | 'delete'; id: number } | null;

/** Soạn phả đồ ngay trên cây: chọn một người rồi thêm con, thêm vợ/chồng, sửa, xóa. */
export function TreeAdmin() {
  const { data, error, loading, reload } = useApi<TreeData>('/tree');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return <Editor data={data} reload={reload} busy={loading} />;
}

function Editor({ data, reload, busy }: { data: TreeData; reload: () => void; busy: boolean }) {
  const toast = useToast();
  const model = useTreeModel(data.members, data.marriages);
  const ref = useRef<FamilyTreeHandle>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [goTo, setGoTo] = useState<number | null>(null);
  const [opt, setOpt] = useState<TreeOptions>({ hideSpouses: false, coupleLines: true, maxGen: null, collapsed: new Set(), rootId: null });

  const sel = selected != null ? model.byId.get(selected) ?? null : null;
  const hits = useMemo(() => (q.trim() ? rankByName(data.members, q).slice(0, 8) : []), [q, data.members]);
  const maxGen = useMemo(() => Math.max(1, ...data.members.map((m) => m.generation ?? 1)), [data.members]);

  // Người mang huyết thống của cặp vợ chồng: con cái gắn vào người này trên cây
  const bloodOf = (m: MemberBrief) => (model.spouseOnly.has(m.id) ? model.byId.get(model.spouses.get(m.id)?.[0] ?? -1) ?? m : m);
  const kidsOf = (id: number) => data.members.filter((m) => m.father_id === id || m.mother_id === id);

  const reveal = (id: number) => {
    const chain: number[] = [];
    let cur = model.byId.get(id);
    if (cur && model.spouseOnly.has(cur.id)) cur = bloodOf(cur);
    while (cur) {
      const p = model.primaryParent(cur);
      if (p == null) break;
      chain.push(p);
      cur = model.byId.get(p);
    }
    setOpt((o) => {
      const collapsed = new Set(o.collapsed);
      chain.forEach((c) => collapsed.delete(c));
      return { ...o, collapsed, maxGen: null, rootId: o.rootId && !chain.includes(o.rootId) && o.rootId !== id ? null : o.rootId };
    });
  };
  const pick = (id: number) => { setSelected(id); reveal(id); setGoTo(id); };

  // Sau khi dữ liệu tải lại, cuộn tới người vừa thêm hoặc vừa chọn
  useEffect(() => {
    if (goTo == null || !model.byId.has(goTo)) return;
    const t = setTimeout(() => { ref.current?.centerOn(goTo); setGoTo(null); }, 60);
    return () => clearTimeout(t);
  }, [goTo, model]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 9000);
    return () => clearTimeout(t);
  }, [undo]);

  const done = (text: string, run: () => Promise<void>, focusId?: number) => {
    setUndo({ text, run });
    reload();
    if (focusId) { setSelected(focusId); setGoTo(focusId); }
  };
  const runUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    try { await u.run(); toast('Đã hoàn tác.'); reload(); } catch (e: any) { toast(e.message ?? 'Không hoàn tác được.', 'error'); }
  };

  const whyNoDelete = (m: MemberBrief): string => {
    const n = kidsOf(m.id).length;
    if (n) return `Người này còn ${n} người con trong phả đồ. Hãy xóa hoặc chuyển các con sang cha mẹ khác trước.`;
    return '';
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-4rem)] -mb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <h1 className="font-serif text-2xl font-semibold text-ink mr-2">Phả đồ</h1>
        <div className="relative w-full sm:w-72">
          <SearchInput className="w-full" placeholder="Tìm tên, không cần dấu" value={q} onChange={setQ} aria-label="Tìm thành viên" />
          {q.trim() && (
            <div className="absolute z-20 top-full mt-1 inset-x-0 rounded-lg border border-line bg-surface shadow-lg p-1 max-h-72 overflow-auto">
              {hits.length ? hits.map((m) => (
                <button key={m.id} type="button" onClick={() => { setQ(''); pick(m.id); }}
                  className="block w-full text-left px-3 py-2 rounded text-sm hover:bg-sunken cursor-pointer">
                  {m.full_name} <span className="text-ink-2">· Đời {m.generation ?? '?'}{m.is_blood ? '' : ' · Dâu, rể'}</span>
                </button>
              )) : <p className="px-3 py-2 text-sm text-ink-2">Không tìm thấy ai khớp với tên này.</p>}
            </div>
          )}
        </div>
        <Checkbox label="Ẩn vợ, chồng" checked={opt.hideSpouses} onChange={(v) => setOpt((o) => ({ ...o, hideSpouses: v }))} />
        <Select aria-label="Hiển thị đến đời" className="w-auto" value={opt.maxGen ?? ''}
          onChange={(e) => setOpt((o) => ({ ...o, maxGen: e.target.value ? Number(e.target.value) : null }))}>
          <option value="">Tất cả các đời</option>
          {Array.from({ length: maxGen }, (_, i) => <option key={i} value={i + 1}>Đến đời {i + 1}</option>)}
        </Select>
        <span className="text-sm text-ink-2 sm:ml-auto">{data.members.length} thành viên · {maxGen} đời{busy ? ' · đang tải' : ''}</span>
      </div>

      {opt.rootId && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg bg-sunken text-sm">
          <span className="flex-1 min-w-0 truncate">Đang xem đời sau của <b>{model.byId.get(opt.rootId)?.full_name}</b></span>
          <Button size="sm" onClick={() => setOpt((o) => ({ ...o, rootId: null }))}>Trở về gốc</Button>
        </div>
      )}

      {!data.members.length ? (
        <div className="flex-1 grid place-items-center rounded-lg border border-dashed border-line-strong text-center p-8">
          <div>
            <p className="font-semibold text-ink">Phả đồ chưa có ai</p>
            <p className="mt-1 text-ink-2">Bắt đầu bằng thủy tổ, rồi thêm con cháu ngay trên cây.</p>
            <Link to="/admin/members/new" className="mt-4 h-10 px-4 inline-flex items-center rounded-lg bg-accent text-white font-medium hover:bg-accent-hover">Thêm thủy tổ</Link>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 flex rounded-lg border border-line overflow-hidden bg-surface">
          <div className="relative flex-1 min-w-0" onClick={() => setSelected(null)}>
            <FamilyTree ref={ref} model={model} options={opt} selectedId={selected} highlight={new Set()}
              onSelect={(id) => setSelected(id)}
              onToggle={(id) => setOpt((o) => {
                const c = new Set(o.collapsed);
                const g = model.byId.get(id)?.generation ?? 1;
                if (o.maxGen && g >= o.maxGen) return { ...o, maxGen: null, collapsed: c };
                if (c.has(id)) c.delete(id); else c.add(id);
                return { ...o, collapsed: c };
              })} />
            <div className="absolute left-3 bottom-3 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" aria-label="Phóng to" onClick={() => ref.current?.zoomBy(1.25)}>+</Button>
              <Button size="sm" aria-label="Thu nhỏ" onClick={() => ref.current?.zoomBy(0.8)}>−</Button>
              <Button size="sm" onClick={() => ref.current?.fit()}>Vừa khung</Button>
            </div>
          </div>
          {sel && (
            <Panel m={sel} model={model} kids={kidsOf(bloodOf(sel).id)} why={whyNoDelete(sel)}
              onClose={() => setSelected(null)} onGo={pick} onAct={(kind) => setDialog({ kind, id: sel.id })}
              onFocus={() => setOpt((o) => ({ ...o, rootId: bloodOf(sel).id, collapsed: new Set() }))} />
          )}
        </div>
      )}

      {dialog?.kind === 'child' && model.byId.has(dialog.id) && (
        <ChildDialog picked={model.byId.get(dialog.id)!} parent={bloodOf(model.byId.get(dialog.id)!)} model={model}
          nextOrder={kidsOf(bloodOf(model.byId.get(dialog.id)!).id).length + 1}
          onClose={() => setDialog(null)}
          onSaved={(id, name, again) => {
            if (!again) setDialog(null);
            setOpt((o) => { const c = new Set(o.collapsed); c.delete(bloodOf(model.byId.get(dialog.id)!).id); return { ...o, collapsed: c, maxGen: null }; });
            done(`Đã thêm ${name}`, async () => { await api.del(`/admin/members/${id}`); }, id);
          }} />
      )}
      {dialog?.kind === 'spouse' && model.byId.has(dialog.id) && (
        <SpouseDialog of={model.byId.get(dialog.id)!} order={(model.spouses.get(dialog.id)?.length ?? 0) + 1}
          onClose={() => setDialog(null)}
          onSaved={(id, name) => { setDialog(null); done(`Đã thêm ${name}`, async () => { await api.del(`/admin/members/${id}`); }, id); }} />
      )}
      {dialog?.kind === 'delete' && model.byId.has(dialog.id) && (
        <DeleteDialog m={model.byId.get(dialog.id)!} onClose={() => setDialog(null)}
          onDeleted={(name, restore) => { setDialog(null); setSelected(null); done(`Đã xóa ${name}`, restore); }} />
      )}

      {undo && (
        <div role="status" className="fixed z-[55] left-1/2 -translate-x-1/2 bottom-5 flex items-center gap-3 rounded-lg bg-ink text-white pl-4 pr-2 py-2 shadow-lg text-sm max-w-[calc(100vw-1.5rem)]">
          <span className="truncate">{undo.text}</span>
          <button type="button" onClick={runUndo} className="h-8 px-3 rounded border border-white/45 font-medium hover:bg-white/10 cursor-pointer">Hoàn tác</button>
        </div>
      )}
    </div>
  );
}

function Panel({ m, model, kids, why, onClose, onGo, onAct, onFocus }: {
  m: MemberBrief; model: ReturnType<typeof useTreeModel>; kids: MemberBrief[]; why: string;
  onClose: () => void; onGo: (id: number) => void; onAct: (k: 'child' | 'spouse' | 'delete') => void; onFocus: () => void;
}) {
  const father = m.father_id ? model.byId.get(m.father_id) : null;
  const mother = m.mother_id ? model.byId.get(m.mother_id) : null;
  const spouses = (model.spouses.get(m.id) ?? []).map((id) => model.byId.get(id)!).filter(Boolean);
  const link = (x: MemberBrief) => (
    <button key={x.id} type="button" onClick={() => onGo(x.id)}
      className="block text-left py-1 underline decoration-line-strong underline-offset-4 hover:decoration-ink cursor-pointer">{x.full_name}</button>
  );
  return (
    <aside aria-label={`Hồ sơ ${m.full_name}`} onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-0 bottom-0 max-h-[62%] md:static md:max-h-none md:w-80 shrink-0 overflow-y-auto bg-surface border-t md:border-t-0 md:border-l border-line rounded-t-2xl md:rounded-none shadow-[0_-8px_24px_rgba(0,0,0,.1)] md:shadow-none p-4 text-sm">
      <div className="flex gap-3">
        <Avatar m={m} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-xl font-medium text-ink leading-tight">{m.full_name}</p>
          <p className="text-ink-2 mt-1">{lifespan(m) || 'Chưa rõ năm sinh'}</p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="size-10 -mr-2 -mt-2 rounded-lg text-xl text-ink-2 hover:bg-sunken hover:text-ink cursor-pointer">×</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.generation && <Badge>Đời {m.generation}</Badge>}
        <Badge>{m.is_blood ? 'Trong họ' : m.gender === 'female' ? 'Dâu' : 'Rể'}</Badge>
        <Badge>{m.is_deceased ? 'Đã mất' : 'Còn sống'}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => onAct('child')}>Thêm con</Button>
        <Link to={`/admin/members/${m.id}`} className="h-10 pointer-coarse:h-11 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-[15px] font-medium hover:bg-sunken">Sửa hồ sơ</Link>
        {!!m.is_blood && <Button onClick={() => onAct('spouse')}>Thêm {m.gender === 'male' ? 'vợ' : 'chồng'}</Button>}
        {kids.length > 0 && <Button onClick={onFocus}>Xem đời sau</Button>}
        <Button variant="danger" disabled={!!why} onClick={() => onAct('delete')}>Xóa</Button>
      </div>
      {why && <p className="mt-2 text-xs text-ink-2">{why}</p>}
      <div className="mt-4 pt-3 border-t border-line grid gap-3">
        {(father || mother) && (
          <div><p className="text-xs font-medium text-ink-2">Cha mẹ</p>{father && link(father)}{mother && link(mother)}</div>
        )}
        {spouses.length > 0 && (
          <div><p className="text-xs font-medium text-ink-2">{m.gender === 'male' ? 'Vợ' : 'Chồng'} ({spouses.length})</p>{spouses.map(link)}</div>
        )}
        {kids.length > 0 && (
          <div><p className="text-xs font-medium text-ink-2">Con ({kids.length})</p>{kids.map(link)}</div>
        )}
      </div>
    </aside>
  );
}

const GENDERS: { value: Gender; label: string }[] = [{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }];

function QuickFields({ v, set }: {
  v: { name: string; gender: Gender; year: string; dead: boolean };
  set: (p: Partial<{ name: string; gender: Gender; year: string; dead: boolean }>) => void;
}) {
  return (
    <>
      <Field label="Họ và tên" htmlFor="qa-name" required>
        <Input id="qa-name" value={v.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Giới tính"><Segmented label="Giới tính" value={v.gender} onChange={(g) => set({ gender: g })} options={GENDERS} /></Field>
        <Field label="Năm sinh" htmlFor="qa-year" hint="Để trống nếu chưa rõ.">
          <Input id="qa-year" inputMode="numeric" maxLength={4} value={v.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </div>
      <Checkbox label="Đã mất" checked={v.dead} onChange={(dead) => set({ dead })} />
    </>
  );
}

function ChildDialog({ picked, parent, model, nextOrder, onClose, onSaved }: {
  picked: MemberBrief; parent: MemberBrief; model: ReturnType<typeof useTreeModel>; nextOrder: number;
  onClose: () => void; onSaved: (id: number, name: string, again: boolean) => void;
}) {
  const partners = (model.spouses.get(parent.id) ?? []).map((id) => model.byId.get(id)!).filter(Boolean);
  const [v, setV] = useState({ name: '', gender: 'male' as Gender, year: '', dead: false });
  const [other, setOther] = useState<string>(String(picked.id !== parent.id ? picked.id : partners[0]?.id ?? ''));
  const [again, setAgain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!v.name.trim()) return setErr('Cần nhập họ và tên.');
    if (v.year && v.year.length !== 4) return setErr('Năm sinh gồm 4 chữ số.');
    setSaving(true); setErr('');
    try {
      const o = other ? Number(other) : null;
      const r = await api.post<{ id: number }>('/admin/members', {
        full_name: v.name.trim(), gender: v.gender, is_blood: 1, is_deceased: v.dead ? 1 : 0, birth_date: v.year || null, birth_order: nextOrder,
        ...(parent.gender === 'male' ? { father_id: parent.id, mother_id: o } : { mother_id: parent.id, father_id: o }),
      });
      onSaved(r.id, v.name.trim(), again);
      if (again) setV({ name: '', gender: 'male', year: '', dead: false });
    } catch (e: any) { setErr(e.message ?? 'Không lưu được.'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Thêm con của ${parent.full_name}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={saving} onClick={save}>Thêm vào phả đồ</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <QuickFields v={v} set={(p) => setV((s) => ({ ...s, ...p }))} />
        {partners.length > 0 && (
          <Field label={`Con của ${parent.full_name} với`} htmlFor="qa-other">
            <Select id="qa-other" value={other} onChange={(e) => setOther(e.target.value)}>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              <option value="">Chưa rõ</option>
            </Select>
          </Field>
        )}
        <Checkbox label="Lưu xong thêm tiếp người con khác" checked={again} onChange={setAgain} />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <p className="text-xs text-ink-2">Ngày giỗ, tiểu sử, ảnh bổ sung sau ở Sửa hồ sơ.</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function SpouseDialog({ of, order, onClose, onSaved }: {
  of: MemberBrief; order: number; onClose: () => void; onSaved: (id: number, name: string) => void;
}) {
  const [v, setV] = useState({ name: '', gender: (of.gender === 'male' ? 'female' : 'male') as Gender, year: '', dead: !!of.is_deceased });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!v.name.trim()) return setErr('Cần nhập họ và tên.');
    if (v.gender === of.gender) return setErr('Vợ chồng cần một nam và một nữ.');
    setSaving(true); setErr('');
    try {
      const r = await api.post<{ id: number }>('/admin/members', {
        full_name: v.name.trim(), gender: v.gender, is_blood: 0, is_deceased: v.dead ? 1 : 0, birth_date: v.year || null,
      });
      try { await api.post('/admin/marriages', { a: of.id, b: r.id, order_no: order }); }
      catch (e) { await api.del(`/admin/members/${r.id}`); throw e; }
      onSaved(r.id, v.name.trim());
    } catch (e: any) { setErr(e.message ?? 'Không lưu được.'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Thêm ${of.gender === 'male' ? 'vợ' : 'chồng'} của ${of.full_name}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={saving} onClick={save}>Thêm vào phả đồ</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <QuickFields v={v} set={(p) => setV((s) => ({ ...s, ...p }))} />
        {order > 1 && <p className="text-sm text-ink-2">Người này sẽ được xếp là {of.gender === 'male' ? 'vợ' : 'chồng'} thứ {order}.</p>}
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function DeleteDialog({ m, onClose, onDeleted }: {
  m: MemberBrief; onClose: () => void; onDeleted: (name: string, restore: () => Promise<void>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setSaving(true); setErr('');
    try {
      // Giữ lại toàn bộ hồ sơ và hôn nhân để hoàn tác được
      const full = await api.get<any>(`/admin/members/${m.id}`);
      await api.del(`/admin/members/${m.id}`);
      onDeleted(m.full_name, async () => {
        const { id: _id, marriages, created_at: _c, updated_at: _u, ...fields } = full;
        const r = await api.post<{ id: number }>('/admin/members', fields);
        for (const mr of (marriages ?? []) as any[]) {
          const partner = mr.husband_id === m.id ? mr.wife_id : mr.husband_id;
          await api.post('/admin/marriages', { a: r.id, b: partner, order_no: mr.order_no, note: mr.note });
        }
      });
    } catch (e: any) { setErr(e.message ?? 'Không xóa được.'); setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Xóa ${m.full_name}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="danger" loading={saving} onClick={run}>Xóa</Button></>}>
      <p>Xóa <b>{m.full_name}</b> khỏi phả đồ, cùng các liên kết hôn nhân của người này.</p>
      <p className="mt-3 text-sm text-ink-2 bg-sunken rounded px-3 py-2">Bạn có thể bấm Hoàn tác ngay sau khi xóa. Ảnh chân dung vẫn được giữ.</p>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
    </Modal>
  );
}
