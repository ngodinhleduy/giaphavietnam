import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Download, Eye, EyeOff, Pencil, Plus, Save, SearchX, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../lib/api.ts';
import type { MemberBrief } from '../lib/types.ts';
import { lifespan } from '../lib/format.ts';
import { fold } from '../../shared/slug.ts';
import { solarToLunar } from '../../shared/lunar.ts';
import {
  Avatar, Badge, Button, EmptyState, ErrorState, Field, Input, LinkButton, Loading, MemberPicker, Modal, PageHeader, Pagination, SearchInput, TableCard, usePageSize, Segmented, Select,
  Switch, cx, useToast,
} from '../components/ui.tsx';
import { DateInput, LunarDayMonth } from '../components/DateInput.tsx';
const RichEditor = lazy(() => import('../components/RichEditor.tsx'));
import { ImageUpload, useMe } from './AdminLayout.tsx';
import { ImportDialog, exportExcel } from './Import.tsx';

type Row = MemberBrief & { father_name: string | null; mother_name: string | null; updated_at: string; is_hidden?: number };

export function MembersAdmin() {
  const { data, error, loading, reload } = useApi<Row[]>('/admin/members');
  const [q, setQ] = useState('');
  const [gen, setGen] = useState('');
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isAdmin = useMe()?.role === 'admin';
  const toast = useToast();
  const [PER, setPER] = usePageSize('members');
  const list = useMemo(() => {
    const f = fold(q);
    return (data ?? []).filter((m) => (!f || fold(m.full_name).includes(f)) && (!gen || m.generation === Number(gen)));
  }, [data, q, gen]);
  useEffect(() => setPage(0), [q, gen]);
  const maxGen = Math.max(1, ...(data ?? []).map((m) => m.generation ?? 1));
  const [removing, setRemoving] = useState<Row | null>(null);
  const [acting, setActing] = useState(false);
  const toggleHidden = async (m: Row) => {
    try {
      await api.put(`/admin/members/${m.id}`, { is_hidden: m.is_hidden ? 0 : 1 });
      toast(m.is_hidden ? `Đã hiện lại ${m.full_name} trên website.` : `Đã ẩn ${m.full_name} khỏi website.`);
      reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const remove = async () => {
    if (!removing) return;
    setActing(true);
    try { await api.del(`/admin/members/${removing.id}`); toast(`Đã xóa ${removing.full_name}.`); setRemoving(null); reload(); }
    catch (e: any) { toast(e.message, 'error'); } finally { setActing(false); }
  };
  const act = 'size-9 inline-flex items-center justify-center rounded-lg text-ink-2 cursor-pointer transition-colors hover:bg-surface hover:text-accent focus-visible:bg-surface focus-visible:text-accent';
  return (
    <>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Xóa thành viên?"
        footer={<><Button onClick={() => setRemoving(null)}>Hủy</Button><Button variant="danger" icon={<Trash2 aria-hidden />} loading={acting} onClick={remove}>Xóa thành viên</Button></>}>
        <p className="text-ink-2"><b className="text-ink">{removing?.full_name}</b> sẽ bị xóa khỏi gia phả cùng các quan hệ vợ chồng. Không hoàn tác được ở màn này. Người còn con trong phả đồ sẽ không xóa được cho tới khi gỡ liên kết con.</p>
      </Modal>
      <PageHeader title="Thành viên" subtitle={data ? `${data.length} người` : undefined}
        actions={<>
          {isAdmin && <Button icon={<Upload aria-hidden />} onClick={() => setImporting(true)}>Nhập từ Excel</Button>}
          {isAdmin && !!data?.length && <Button loading={exporting} icon={<Download aria-hidden />} onClick={async () => {
            setExporting(true);
            try { toast(`Đã xuất ${await exportExcel()} người ra file Excel.`); } catch (e: any) { toast(e.message, 'error'); } finally { setExporting(false); }
          }}>Xuất Excel</Button>}
          <LinkButton to="/admin/members/new" variant="primary" icon={<UserPlus aria-hidden />}>Thêm thành viên</LinkButton>
        </>} />
      {isAdmin && <ImportDialog open={importing} existing={(data ?? []) as any} onClose={() => setImporting(false)} onDone={reload} />}
      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput className="flex-1 sm:flex-none sm:w-80" placeholder="Tìm tên (không cần dấu)" value={q} onChange={setQ} aria-label="Tìm thành viên" />
        <Select className="w-auto" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="Đời">
          <option value="">Mọi đời</option>
          {Array.from({ length: maxGen }, (_, i) => <option key={i} value={i + 1}>Đời {i + 1}</option>)}
        </Select>
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<Users />} title="Chưa có thành viên" text="Nhập thủy tổ trước, rồi thêm con cháu. Có sẵn danh sách thì dùng Nhập từ Excel."
          action={<Link to="/admin/members/new" className="text-accent font-medium">Nhập thủy tổ</Link>} />
      ) : !list.length ? <EmptyState icon={<SearchX />} title="Không tìm thấy ai" text="Thử tên khác hoặc bỏ bộ lọc đời." /> : (
        <TableCard footer={<Pagination page={page} size={PER} total={list.length} onPage={setPage} onSize={setPER} unit="người" />}>
          <ul className="md:hidden divide-y divide-line">
            {list.slice(page * PER, page * PER + PER).map((m) => (
              <li key={m.id}>
                <Link to={`/admin/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 min-h-16 hover:bg-sunken/50">
                  <Avatar m={m} size={40} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-ink truncate">{m.full_name}</span>
                    <span className="block text-sm text-ink-2 truncate">
                      Đời {m.generation}{lifespan(m) ? ` · ${lifespan(m)}` : ''}{m.father_name ? ` · con ${m.father_name}` : ''}
                    </span>
                  </span>
                  {!m.is_blood && <Badge tone="gold">{m.gender === 'female' ? 'Dâu' : 'Rể'}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <table className="gp-table w-full text-[15px]">
            <thead className="text-left text-sm text-ink-2">
              <tr>
                <th className="font-medium pl-4 pr-2 h-11 w-14 text-right">STT</th>
                <th className="font-medium px-4 h-11">Họ tên</th>
                <th className="font-medium px-4 w-16">Đời</th>
                <th className="font-medium px-4">Cha / mẹ</th>
                <th className="font-medium px-4">Năm</th>
                <th className="font-medium px-4">Loại</th>
                <th className="font-medium px-4 w-36"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.slice(page * PER, page * PER + PER).map((m, i) => (
                <tr key={m.id} className="group/row h-13 transition-colors hover:bg-accent-soft/60 focus-within:bg-accent-soft/60">
                  <td className="pl-4 pr-2 text-right text-sm text-ink-2 tabular-nums">{page * PER + i + 1}</td>
                  <td className="px-4 py-2">
                    <Link to={`/admin/members/${m.id}`} className="flex items-center gap-3 font-medium text-ink hover:text-accent">
                      <Avatar m={m} size={32} />{m.full_name}
                    </Link>
                  </td>
                  <td className="px-4 tabular-nums">{m.generation}</td>
                  <td className="px-4 text-ink-2 text-sm max-w-64">{[m.father_name, m.mother_name].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 text-ink-2 text-sm whitespace-nowrap">{lifespan(m)}</td>
                  <td className="px-4"><span className="inline-flex gap-1.5">{m.is_blood ? <Badge>{m.gender === 'male' ? 'Nam' : 'Nữ'}</Badge> : <Badge tone="gold">{m.gender === 'female' ? 'Dâu' : 'Rể'}</Badge>}{!!m.is_hidden && <Badge tone="danger"><EyeOff aria-hidden />Đang ẩn</Badge>}</span></td>
                  <td className="px-2">
                    {/* Thao tác nhanh: hiện khi rê chuột hoặc focus vào dòng; màn cảm ứng luôn hiện */}
                    <span className="opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100 transition-opacity flex justify-end gap-0.5">
                      <Link to={`/admin/members/${m.id}`} className={act} aria-label={`Sửa ${m.full_name}`} title="Chỉnh sửa"><Pencil aria-hidden className="size-[18px]" /></Link>
                      <button type="button" className={act} onClick={() => toggleHidden(m)} aria-label={m.is_hidden ? `Hiện lại ${m.full_name} trên website` : `Ẩn ${m.full_name} khỏi website`} title={m.is_hidden ? 'Hiện lại trên website' : 'Ẩn khỏi website'}>
                        {m.is_hidden ? <Eye aria-hidden className="size-[18px]" /> : <EyeOff aria-hidden className="size-[18px]" />}
                      </button>
                      <button type="button" className={cx(act, 'hover:!bg-danger-soft hover:!text-danger focus-visible:!bg-danger-soft focus-visible:!text-danger')} onClick={() => setRemoving(m)} aria-label={`Xóa ${m.full_name}`} title="Xóa"><Trash2 aria-hidden className="size-[18px]" /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </TableCard>
      )}
    </>
  );
}

type Form = {
  full_name: string; alias: string; gender: 'male' | 'female'; father_id: number | null; mother_id: number | null;
  birth_order: string; is_blood: boolean; is_deceased: boolean; birth_date: string; death_date: string;
  death_lunar_day: string; death_lunar_month: string; branch: string; hometown: string; occupation: string;
  burial_place: string; bio: string; photo_file_id: number | null; generation: string;
  is_hidden: boolean; title_role: string; child_type: string;
};
const EMPTY: Form = {
  full_name: '', alias: '', gender: 'male', father_id: null, mother_id: null, birth_order: '', is_blood: true,
  is_deceased: false, birth_date: '', death_date: '', death_lunar_day: '', death_lunar_month: '', branch: '', hometown: '',
  occupation: '', burial_place: '', bio: '', photo_file_id: null, generation: '',
  is_hidden: false, title_role: '', child_type: 'biological',
};
type MarriageRow = { id: number; husband_id: number; wife_id: number; husband_name: string; wife_name: string; order_no: number };
type Then = 'stay' | 'child' | 'sibling';

const ORDER_LABEL = (n: number) => (n === 1 ? 'Con trưởng (thứ 1)' : n === 2 ? 'Con thứ 2' : `Con thứ ${n}`);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function MemberForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const all = useApi<Row[]>('/admin/members');
  const detail = useApi<any>(isNew ? null : `/admin/members/${id}`);
  const [f, setF] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [spouseOpen, setSpouseOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [quick, setQuick] = useState<{ role: 'father' | 'mother'; name: string } | null>(null);
  const [lunarAuto, setLunarAuto] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (isNew) {
      const init = {
        ...EMPTY,
        father_id: sp.get('father') ? Number(sp.get('father')) : null,
        mother_id: sp.get('mother') ? Number(sp.get('mother')) : null,
        gender: (sp.get('gender') === 'female' ? 'female' : 'male') as Form['gender'],
        is_blood: sp.get('inlaw') !== '1',
        birth_order: sp.get('order') ?? '',
      };
      setF(init);
      setSaved(init);
    } else if (detail.data) {
      const d = detail.data;
      const s = (v: unknown) => (v == null ? '' : String(v));
      const v: Form = {
        full_name: d.full_name, alias: s(d.alias), gender: d.gender, father_id: d.father_id, mother_id: d.mother_id,
        birth_order: s(d.birth_order), is_blood: !!d.is_blood, is_deceased: !!d.is_deceased, birth_date: s(d.birth_date),
        death_date: s(d.death_date), death_lunar_day: s(d.death_lunar_day), death_lunar_month: s(d.death_lunar_month),
        branch: s(d.branch), hometown: s(d.hometown), occupation: s(d.occupation), burial_place: s(d.burial_place),
        bio: s(d.bio), photo_file_id: d.photo_file_id, generation: s(d.generation),
        is_hidden: !!d.is_hidden, title_role: s(d.title_role), child_type: d.child_type || 'biological',
      };
      setF(v);
      setSaved(v);
    }
  }, [isNew, detail.data, sp]);

  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const members = all.data ?? [];
  const self = isNew ? null : Number(id);
  const branches = useMemo(() => [...new Set(members.map((m) => m.branch).filter(Boolean))] as string[], [members]);
  const father = members.find((m) => m.id === f.father_id);
  const hasExtra = !!(f.alias || f.branch || f.hometown || f.occupation || f.burial_place || !f.is_blood || f.is_hidden || f.title_role || f.child_type !== 'biological');

  // Ngày mất đầy đủ mà chưa có ngày giỗ thì tự điền
  const onDeathDate = (v: string) => {
    setF((x) => {
      const n = { ...x, death_date: v };
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m && (!x.death_lunar_day || lunarAuto)) {
        const l = solarToLunar(+m[3], +m[2], +m[1]);
        n.death_lunar_day = String(l.day);
        n.death_lunar_month = String(l.month);
        setLunarAuto(true);
      }
      return n;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.full_name.trim()) e.full_name = 'Nhập họ và tên.';
    if (!!f.death_lunar_day !== !!f.death_lunar_month) e.death_lunar = 'Chọn đủ cả ngày và tháng.';
    if (f.birth_date && f.death_date && f.death_date.slice(0, 4) < f.birth_date.slice(0, 4)) e.death_date = 'Năm mất đang trước năm sinh.';
    setErrors(e);
    if (Object.keys(e).length) document.getElementById(Object.keys(e)[0] === 'full_name' ? 'fn' : 'dd')?.focus();
    return !Object.keys(e).length;
  };

  const save = async (then: Then = 'stay') => {
    if (!validate()) return;
    setBusy(true);
    const n = (v: string) => (v === '' ? null : Number(v));
    const body = {
      ...f, full_name: f.full_name.trim(), birth_order: n(f.birth_order), death_lunar_day: f.is_deceased ? n(f.death_lunar_day) : null,
      death_lunar_month: f.is_deceased ? n(f.death_lunar_month) : null, death_date: f.is_deceased ? f.death_date : null,
      burial_place: f.is_deceased ? f.burial_place : null,
      generation: n(f.generation), is_blood: f.is_blood ? 1 : 0, is_deceased: f.is_deceased ? 1 : 0, is_hidden: f.is_hidden ? 1 : 0,
      spouse_id: isNew ? (sp.get('spouse') ? Number(sp.get('spouse')) : null) : undefined,
    };
    try {
      let newId = self;
      if (isNew) newId = (await api.post<{ id: number }>('/admin/members', body)).id;
      else await api.put(`/admin/members/${id}`, body);
      setSaved(f);
      toast(`Đã lưu ${f.full_name.trim()}.`);
      all.reload();
      if (then === 'child') {
        const mr = (detail.data?.marriages ?? []) as MarriageRow[];
        const spouse = mr.length === 1 ? (mr[0].husband_id === newId ? mr[0].wife_id : mr[0].husband_id) : null;
        const q = new URLSearchParams({ [f.gender === 'male' ? 'father' : 'mother']: String(newId) });
        if (spouse) q.set(f.gender === 'male' ? 'mother' : 'father', String(spouse));
        nav(`/admin/members/new?${q}`);
      } else if (then === 'sibling') {
        const q = new URLSearchParams();
        if (f.father_id) q.set('father', String(f.father_id));
        if (f.mother_id) q.set('mother', String(f.mother_id));
        if (f.birth_order) q.set('order', String(Number(f.birth_order) + 1));
        nav(`/admin/members/new?${q}`);
      } else if (isNew) nav(`/admin/members/${newId}`, { replace: true });
      else detail.reload();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (force = false) => {
    try {
      await api.del(`/admin/members/${id}${force ? '?force=1' : ''}`);
      toast('Đã xóa.');
      nav('/admin/members');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (!isNew && detail.loading) return <Loading />;
  if (detail.error) return <ErrorState error={detail.error} />;
  const marriages: MarriageRow[] = detail.data?.marriages ?? [];
  const children = self ? members.filter((m) => m.father_id === self || m.mother_id === self) : [];
  const childGen = Number(f.generation) || (father?.generation ? father.generation + 1 : 0);

  return (
    <>
      <PageHeader back={[{ to: '/admin/members', label: 'Thành viên' }]} title={isNew ? 'Thêm thành viên' : f.full_name || 'Thành viên'}
        subtitle={!isNew && f.generation ? `Đời thứ ${f.generation}${dirty ? ' · Có thay đổi chưa lưu' : ''}` : dirty && !isNew ? 'Có thay đổi chưa lưu' : undefined}
        actions={!isNew ? <a href={`/thanh-vien/${id}`} target="_blank" rel="noreferrer" className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium hover:bg-sunken">Xem trang</a> : undefined} />

      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate
        className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px] max-w-[88rem] max-lg:pb-24">
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* ===== Chính ===== */}
          <Section title="Thông tin chính">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên" htmlFor="fn" required error={errors.full_name} className="sm:col-span-2">
                <Input id="fn" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} aria-invalid={!!errors.full_name}
                  autoComplete="off" autoFocus={isNew} className="h-11 text-base" placeholder="Ví dụ: Ngô Đình An" />
              </Field>
              <Field label="Giới tính" htmlFor="g" required>
                <Segmented id="g" label="Giới tính" value={f.gender} onChange={(v) => set('gender', v)}
                  options={[{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }]} />
              </Field>
              <Field label="Tình trạng" htmlFor="st">
                <Segmented id="st" label="Tình trạng" value={f.is_deceased ? 'dead' : 'alive'} onChange={(v) => set('is_deceased', v === 'dead')}
                  options={[{ value: 'alive', label: 'Còn sống' }, { value: 'dead', label: 'Đã mất' }]} />
              </Field>
              <Field label="Ngày sinh" htmlFor="bd" hint="Không rõ ngày thì gõ năm, hoặc chọn “Chỉ biết năm” trong lịch.">
                <DateInput id="bd" value={f.birth_date} onChange={(v) => set('birth_date', v)} max={todayIso()} />
              </Field>
              {f.is_deceased && (
                <Field label="Ngày mất" htmlFor="dd" error={errors.death_date}>
                  <DateInput id="dd" value={f.death_date} onChange={onDeathDate} showLunar max={todayIso()} ariaInvalid={!!errors.death_date} />
                </Field>
              )}
              {f.is_deceased && (
                <Field label="Ngày giỗ (âm lịch)" htmlFor="ld" error={errors.death_lunar} className="sm:col-span-2"
                  hint={lunarAuto ? 'Đã tự điền theo ngày mất. Sửa lại nếu gia đình giỗ ngày khác.' : 'Ngày giỗ hằng năm hiện trên lịch sự kiện.'}>
                  <LunarDayMonth id="ld" day={f.death_lunar_day} month={f.death_lunar_month}
                    onChange={(d, m) => { setLunarAuto(false); setF((x) => ({ ...x, death_lunar_day: d, death_lunar_month: m })); }} />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Cha mẹ" hint="Gõ tên để tìm. Chưa có trong phả thì chọn “Thêm mới” ở cuối danh sách. Đời được tính tự động.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cha" htmlFor="fa">
                <MemberPicker id="fa" members={members} value={f.father_id} onChange={(v) => set('father_id', v)}
                  filter={(m) => m.gender === 'male' && m.id !== self} createLabel="Thêm cha mới"
                  onCreate={(name) => setQuick({ role: 'father', name })} editHref={(i) => `/admin/members/${i}`} />
              </Field>
              <Field label="Mẹ" htmlFor="mo">
                <MemberPicker id="mo" members={members} value={f.mother_id} onChange={(v) => set('mother_id', v)}
                  filter={(m) => m.gender === 'female' && m.id !== self} createLabel="Thêm mẹ mới"
                  onCreate={(name) => setQuick({ role: 'mother', name })} editHref={(i) => `/admin/members/${i}`} />
              </Field>
              <Field label="Thứ tự trong anh chị em" htmlFor="bo" hint="Dùng để xếp anh em và tính vai trên dưới khi tra xưng hô.">
                <Select id="bo" value={f.birth_order} onChange={(e) => set('birth_order', e.target.value)}>
                  <option value="">Chưa rõ</option>
                  {Array.from({ length: 15 }, (_, i) => <option key={i} value={i + 1}>{ORDER_LABEL(i + 1)}</option>)}
                </Select>
              </Field>
              {!f.father_id && !f.mother_id && f.is_blood && (
                <Field label="Đời thứ" htmlFor="gen" hint="Chỉ nhập cho thủy tổ hoặc người chưa rõ cha mẹ. Người có cha mẹ được tính tự động.">
                  <Input id="gen" type="number" inputMode="numeric" min={1} value={f.generation} onChange={(e) => set('generation', e.target.value)} />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Tiểu sử" hint="Công trạng, học vị, chức tước, giai thoại... Có thể chèn ảnh và liên kết.">
            <Suspense fallback={<div className="h-60 rounded-lg border border-line-strong bg-surface animate-pulse" />}>
              <RichEditor id="bio" value={f.bio} onChange={(v) => set('bio', v)} placeholder="Viết vài dòng về cuộc đời của người này..." />
            </Suspense>
          </Section>

          {/* ===== Phụ ===== */}
          <details open={hasExtra} className="group rounded-xl border border-line bg-surface">
            <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 min-h-14 cursor-pointer list-none">
              <span>
                <span className="block font-semibold text-ink">Thông tin bổ sung</span>
                <span className="block text-sm text-ink-3">Tên khác, chi, quê quán, nghề nghiệp{f.is_deceased ? ', nơi an táng' : ''}</span>
              </span>
              <svg viewBox="0 0 20 20" className="size-5 text-ink-2 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8l5 5 5-5" /></svg>
            </summary>
            <div className="px-4 sm:px-5 pb-5 grid gap-4 sm:grid-cols-2 border-t border-line pt-4">
              <Field label="Tên khác" htmlFor="al" hint="Tên tự, tên húy, thụy hiệu hoặc tên thường gọi.">
                <Input id="al" value={f.alias} onChange={(e) => set('alias', e.target.value)} />
              </Field>
              <Field label="Chi / nhánh" htmlFor="br" hint={branches.length ? 'Chọn chi đã có hoặc gõ tên mới.' : undefined}>
                <Input id="br" list="branch-list" value={f.branch} onChange={(e) => set('branch', e.target.value)} />
                <datalist id="branch-list">{branches.map((b) => <option key={b} value={b} />)}</datalist>
              </Field>
              <Field label="Chức danh, vai vế" htmlFor="tr" hint="Ví dụ: Cụ Tổ, Trưởng chi, Mệ Đích.">
                <Input id="tr" value={f.title_role} onChange={(e) => set('title_role', e.target.value)} />
              </Field>
              <Field label="Quan hệ với cha mẹ" htmlFor="ct">
                <Select id="ct" value={f.child_type} onChange={(e) => set('child_type', e.target.value)}>
                  <option value="biological">Con ruột</option>
                  <option value="adopted">Con nuôi</option>
                  <option value="out_of_wedlock">Con ngoài giá thú</option>
                </Select>
              </Field>
              <Field label="Quê quán" htmlFor="ht"><Input id="ht" value={f.hometown} onChange={(e) => set('hometown', e.target.value)} /></Field>
              <Field label="Nghề nghiệp" htmlFor="oc"><Input id="oc" value={f.occupation} onChange={(e) => set('occupation', e.target.value)} /></Field>
              {f.is_deceased && (
                <Field label="Nơi an táng" htmlFor="bp" className="sm:col-span-2">
                  <Input id="bp" value={f.burial_place} onChange={(e) => set('burial_place', e.target.value)} placeholder="Ví dụ: Nghĩa trang họ, xứ Đồng Cả" />
                </Field>
              )}
              <div className="sm:col-span-2 pt-1">
                <Switch label="Mang huyết thống dòng họ" checked={f.is_blood} onChange={(v) => set('is_blood', v)}
                  description="Tắt với con dâu, con rể. Người không mang huyết thống hiện cạnh vợ/chồng trên cây, nền xám nhạt." />
              </div>
              <div className="sm:col-span-2">
                <Switch label="Ẩn trên website" checked={f.is_hidden} onChange={(v) => set('is_hidden', v)}
                  description="Con cháu xem trang sẽ không thấy người này trên phả đồ, danh sách và lịch giỗ. Người quản trị vẫn thấy, viền nét đứt." />
              </div>
            </div>
          </details>
        </div>

        <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6 self-start min-w-0">
          <Section title="Ảnh chân dung">
            <ImageUpload value={f.photo_file_id} onChange={(v) => set('photo_file_id', v)} label="Ảnh" round />
          </Section>
          <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:bg-surface/95 max-lg:backdrop-blur max-lg:border-t max-lg:border-line max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-row-reverse lg:flex-col gap-2">
            <Button type="submit" variant="primary" loading={busy} icon={isNew ? <UserPlus aria-hidden /> : <Save aria-hidden />} className="flex-1 lg:flex-none">{isNew ? 'Thêm thành viên' : 'Lưu thay đổi'}</Button>
            <SaveMore busy={busy} canSibling={!!(f.father_id || f.mother_id)} onPick={(t) => save(t)} />
          </div>
          {!isNew && (
            <>
              <Section title={f.gender === 'male' ? 'Vợ' : 'Chồng'}>
                {!marriages.length && <p className="text-sm text-ink-3 mb-3">Chưa có.</p>}
                <ul className="space-y-1 mb-3">
                  {marriages.map((mr) => {
                    const otherId = mr.husband_id === self ? mr.wife_id : mr.husband_id;
                    const name = mr.husband_id === self ? mr.wife_name : mr.husband_name;
                    return (
                      <li key={mr.id} className="flex items-center gap-2 text-[15px] min-h-10">
                        <Link to={`/admin/members/${otherId}`} className="flex-1 hover:text-accent truncate">{name}</Link>
                        {marriages.length > 1 && <Badge>{mr.order_no === 1 ? 'Cả' : `Thứ ${mr.order_no}`}</Badge>}
                        <button type="button" aria-label={`Gỡ quan hệ với ${name}`} className="size-8 pointer-coarse:size-10 rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger cursor-pointer"
                          onClick={async () => { if (confirm(`Gỡ quan hệ hôn nhân với ${name}? Hồ sơ của ${name} vẫn được giữ.`)) { await api.del(`/admin/marriages/${mr.id}`); detail.reload(); } }}>×</button>
                      </li>
                    );
                  })}
                </ul>
                <Button type="button" size="sm" icon={<Plus aria-hidden />} onClick={() => setSpouseOpen(true)}>Thêm {f.gender === 'male' ? 'vợ' : 'chồng'}</Button>
              </Section>
              <Section title={`Con (${children.length})`}>
                <ul className="space-y-0.5 mb-3">
                  {children.map((c) => (
                    <li key={c.id}><Link to={`/admin/members/${c.id}`} className="flex items-center justify-between gap-2 min-h-9 pointer-coarse:min-h-11 text-[15px] hover:text-accent">
                      <span className="truncate">{c.full_name}</span><span className="text-xs text-ink-3 shrink-0">{c.birth_order ? `Thứ ${c.birth_order}` : ''}</span>
                    </Link></li>
                  ))}
                </ul>
                <Button type="button" size="sm" disabled={busy} onClick={() => (dirty ? save('child') : nav(`/admin/members/new?${new URLSearchParams({
                  [f.gender === 'male' ? 'father' : 'mother']: String(self),
                  ...(marriages.length === 1 ? { [f.gender === 'male' ? 'mother' : 'father']: String(marriages[0].husband_id === self ? marriages[0].wife_id : marriages[0].husband_id) } : {}),
                  order: String(children.length + 1),
                })}`))}>Thêm con</Button>
              </Section>
              <Button type="button" variant="danger" onClick={() => setDelOpen(true)}>Xóa thành viên</Button>
            </>
          )}
        </div>
      </form>

      {quick && (
        <QuickParentModal role={quick.role} initialName={quick.name} childGen={childGen}
          spouseId={quick.role === 'father' ? f.mother_id : f.father_id}
          onClose={() => setQuick(null)}
          onCreated={(newId) => { set(quick.role === 'father' ? 'father_id' : 'mother_id', newId); setQuick(null); all.reload(); }} />
      )}
      {!isNew && self && (
        <SpouseModal open={spouseOpen} onClose={() => setSpouseOpen(false)} self={self} gender={f.gender} members={members}
          nextOrder={marriages.length + 1} onDone={() => { setSpouseOpen(false); detail.reload(); all.reload(); }} />
      )}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Xóa thành viên?"
        footer={<>
          <Button onClick={() => setDelOpen(false)}>Hủy</Button>
          <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={() => remove(children.length > 0)}>Xóa</Button>
        </>}>
        <p className="text-ink-2">
          Xóa <b className="text-ink">{f.full_name}</b> khỏi phả đồ. Thao tác này không hoàn tác được.
          {children.length > 0 && <> Người này có <b className="text-ink">{children.length} người con</b>; các con sẽ mất liên kết cha/mẹ và hiện như một nhánh riêng.</>}
        </p>
      </Modal>
    </>
  );
}

/** Nút phụ "Lưu và..." gom vào menu để không chiếm chỗ. */
function SaveMore({ busy, canSibling, onPick }: { busy: boolean; canSibling: boolean; onPick: (t: Then) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => window.addEventListener('click', close, { once: true }));
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div className="relative flex-1 lg:flex-none">
      <Button type="button" disabled={busy} className="w-full" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Lưu và thêm…
      </Button>
      {open && (
        <div className="absolute z-30 bottom-full mb-1 lg:bottom-auto lg:top-full lg:mt-1 left-0 right-0 rounded-lg border border-line bg-surface shadow-lg py-1">
          <button type="button" onClick={() => onPick('child')} className="w-full text-left px-3 py-2.5 min-h-11 hover:bg-sunken cursor-pointer">
            <span className="block text-[15px] font-medium">Thêm con</span><span className="block text-xs text-ink-3">Đi xuống đời tiếp theo</span>
          </button>
          <button type="button" disabled={!canSibling} onClick={() => onPick('sibling')} className="w-full text-left px-3 py-2.5 min-h-11 hover:bg-sunken cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <span className="block text-[15px] font-medium">Thêm anh chị em</span><span className="block text-xs text-ink-3">{canSibling ? 'Cùng cha mẹ, thứ tự tiếp theo' : 'Cần chọn cha hoặc mẹ trước'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Tạo nhanh cha hoặc mẹ ngay trong form, có thể sửa đầy đủ sau. */
function QuickParentModal({ role, initialName, childGen, spouseId, onClose, onCreated }: {
  role: 'father' | 'mother'; initialName: string; childGen: number; spouseId: number | null;
  onClose: () => void; onCreated: (id: number) => void;
}) {
  const [name, setName] = useState(initialName);
  const [birth, setBirth] = useState('');
  const [dead, setDead] = useState(false);
  const [blood, setBlood] = useState(role === 'father');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const label = role === 'father' ? 'cha' : 'mẹ';
  const submit = async () => {
    if (!name.trim()) { setErr('Nhập họ và tên.'); return; }
    setBusy(true);
    try {
      const r = await api.post<{ id: number }>('/admin/members', {
        full_name: name.trim(), gender: role === 'father' ? 'male' : 'female', birth_date: birth,
        is_deceased: dead ? 1 : 0, is_blood: blood ? 1 : 0, generation: childGen > 1 ? childGen - 1 : null,
      });
      // Đã chọn người còn lại thì nối luôn quan hệ vợ chồng
      if (spouseId) await api.post('/admin/marriages', { a: r.id, b: spouseId, order_no: 1 }).catch(() => {});
      toast(`Đã thêm ${label} ${name.trim()}. Có thể bổ sung thông tin sau qua link “Sửa hồ sơ”.`);
      onCreated(r.id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Thêm ${label} mới`} width="max-w-md"
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy} onClick={submit}>Thêm và chọn</Button></>}>
      <div className="space-y-4">
        <Field label="Họ và tên" htmlFor="qp-name" required error={err}>
          <Input id="qp-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())} />
        </Field>
        <Field label="Ngày sinh" htmlFor="qp-birth" optional>
          <DateInput id="qp-birth" value={birth} onChange={setBirth} max={todayIso()} />
        </Field>
        <Segmented label="Tình trạng" value={dead ? 'dead' : 'alive'} onChange={(v) => setDead(v === 'dead')}
          options={[{ value: 'alive', label: 'Còn sống' }, { value: 'dead', label: 'Đã mất' }]} />
        <Switch label="Mang huyết thống dòng họ" checked={blood} onChange={setBlood}
          description={role === 'mother' ? 'Thường tắt: mẹ là con dâu trong họ.' : 'Thường bật: cha là người trong họ.'} />
        {spouseId && <p className="text-sm text-ink-3">Sẽ tự nối quan hệ vợ chồng với {role === 'father' ? 'mẹ' : 'cha'} đã chọn.</p>}
      </div>
    </Modal>
  );
}

function SpouseModal({ open, onClose, self, gender, members, nextOrder, onDone }: {
  open: boolean; onClose: () => void; self: number; gender: 'male' | 'female'; members: MemberBrief[]; nextOrder: number; onDone: () => void;
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [order, setOrder] = useState(String(nextOrder));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const other = gender === 'male' ? 'female' : 'male';
  const word = gender === 'male' ? 'vợ' : 'chồng';
  useEffect(() => { setOrder(String(nextOrder)); }, [nextOrder]);
  const submit = async () => {
    setBusy(true);
    try {
      let sid = pick;
      if (mode === 'new') {
        if (!name.trim()) throw new Error('Nhập họ tên.');
        sid = (await api.post<{ id: number }>('/admin/members', { full_name: name.trim(), gender: other, birth_date: birth, is_blood: 0, is_deceased: 0 })).id;
      }
      if (!sid) throw new Error('Chọn một người.');
      await api.post('/admin/marriages', { a: self, b: sid, order_no: Number(order) || 1 });
      toast('Đã thêm.');
      setName('');
      setBirth('');
      setPick(null);
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Thêm ${word}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy} onClick={submit}>Thêm</Button></>}>
      <div className="space-y-4">
        <Segmented label="Nguồn" value={mode} onChange={setMode}
          options={[{ value: 'new', label: `Người mới (${gender === 'male' ? 'dâu' : 'rể'})` }, { value: 'existing', label: 'Đã có trong phả' }]} />
        {mode === 'new' ? (
          <>
            <Field label="Họ và tên" htmlFor="sn" required hint="Bổ sung chi tiết sau trong hồ sơ của người này.">
              <Input id="sn" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Ngày sinh" htmlFor="sb" optional><DateInput id="sb" value={birth} onChange={setBirth} max={todayIso()} /></Field>
          </>
        ) : (
          <Field label="Chọn người" htmlFor="sp" required><MemberPicker id="sp" members={members} value={pick} onChange={setPick} filter={(m) => m.gender === other} /></Field>
        )}
        <Field label="Thứ tự" htmlFor="so">
          <Select id="so" value={order} onChange={(e) => setOrder(e.target.value)} className="w-full sm:w-48">
            {Array.from({ length: 6 }, (_, i) => <option key={i} value={i + 1}>{i === 0 ? `${word === 'vợ' ? 'Vợ' : 'Chồng'} cả` : `${word === 'vợ' ? 'Vợ' : 'Chồng'} thứ ${i + 1}`}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function Section({ title, hint, children, icon }: { title: string; hint?: React.ReactNode; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="gp-surface rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        {icon && <span aria-hidden className="text-accent [&_svg]:size-[18px]">{icon}</span>}
        {title}
      </h2>
      {hint && <p className="text-sm text-ink-3 mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
