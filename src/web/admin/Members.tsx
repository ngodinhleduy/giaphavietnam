import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../lib/api.ts';
import type { MemberBrief } from '../lib/types.ts';
import { lifespan } from '../lib/format.ts';
import { fold } from '../../shared/slug.ts';
import { solarToLunar } from '../../shared/lunar.ts';
import {
  Avatar, Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Loading, MemberPicker, Modal, PageHeader, Select,
  Textarea, useToast,
} from '../components/ui.tsx';
import { ImageUpload } from './AdminLayout.tsx';

type Row = MemberBrief & { father_name: string | null; mother_name: string | null; updated_at: string };

export function MembersAdmin() {
  const { data, error, loading, reload } = useApi<Row[]>('/admin/members');
  const [q, setQ] = useState('');
  const [gen, setGen] = useState('');
  const [page, setPage] = useState(0);
  const PER = 50;
  const list = useMemo(() => {
    const f = fold(q);
    return (data ?? []).filter((m) => (!f || fold(m.full_name).includes(f)) && (!gen || m.generation === Number(gen)));
  }, [data, q, gen]);
  useEffect(() => setPage(0), [q, gen]);
  const maxGen = Math.max(1, ...(data ?? []).map((m) => m.generation ?? 1));
  return (
    <>
      <PageHeader title="Thành viên" subtitle={data ? `${data.length} người` : undefined}
        actions={<Link to="/admin/members/new" className="h-10 px-4 inline-flex items-center rounded-lg bg-accent text-white font-medium hover:bg-accent-hover">Thêm thành viên</Link>} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="sm:w-72" placeholder="Tìm tên (không cần dấu)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm" />
        <Select className="w-auto" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="Đời">
          <option value="">Mọi đời</option>
          {Array.from({ length: maxGen }, (_, i) => <option key={i} value={i + 1}>Đời {i + 1}</option>)}
        </Select>
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="Chưa có thành viên" text="Bắt đầu bằng việc nhập thủy tổ (đời 1), sau đó thêm con cháu từ hồ sơ của từng người."
          action={<Link to="/admin/members/new" className="text-accent font-medium">Nhập thủy tổ</Link>} />
      ) : !list.length ? <EmptyState title="Không có kết quả" /> : (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead className="text-left text-sm text-ink-2 bg-sunken/60">
              <tr>
                <th className="font-medium px-4 h-11">Họ tên</th>
                <th className="font-medium px-4 w-16">Đời</th>
                <th className="font-medium px-4">Cha / mẹ</th>
                <th className="font-medium px-4">Năm</th>
                <th className="font-medium px-4">Loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.slice(page * PER, page * PER + PER).map((m) => (
                <tr key={m.id} className="hover:bg-sunken/50">
                  <td className="px-4 py-2">
                    <Link to={`/admin/members/${m.id}`} className="flex items-center gap-3 font-medium text-ink hover:text-accent">
                      <Avatar m={m} size={32} />{m.full_name}
                    </Link>
                  </td>
                  <td className="px-4 tabular-nums">{m.generation}</td>
                  <td className="px-4 text-ink-2 text-sm">{[m.father_name, m.mother_name].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 text-ink-2 text-sm whitespace-nowrap">{lifespan(m)}</td>
                  <td className="px-4">{m.is_blood ? <Badge>{m.gender === 'male' ? 'Nam' : 'Nữ'}</Badge> : <Badge tone="gold">{m.gender === 'female' ? 'Dâu' : 'Rể'}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > PER && (
            <div className="flex items-center justify-between px-4 h-12 border-t border-line text-sm text-ink-2">
              <span>{page * PER + 1}–{Math.min(list.length, (page + 1) * PER)} / {list.length}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={!page} onClick={() => setPage(page - 1)}>Trước</Button>
                <Button size="sm" disabled={(page + 1) * PER >= list.length} onClick={() => setPage(page + 1)}>Sau</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

type Form = {
  full_name: string; alias: string; gender: 'male' | 'female'; father_id: number | null; mother_id: number | null;
  birth_order: string; is_blood: boolean; is_deceased: boolean; birth_date: string; death_date: string;
  death_lunar_day: string; death_lunar_month: string; branch: string; hometown: string; occupation: string;
  burial_place: string; bio: string; photo_file_id: number | null; generation: string;
};
const EMPTY: Form = {
  full_name: '', alias: '', gender: 'male', father_id: null, mother_id: null, birth_order: '', is_blood: true,
  is_deceased: false, birth_date: '', death_date: '', death_lunar_day: '', death_lunar_month: '', branch: '', hometown: '',
  occupation: '', burial_place: '', bio: '', photo_file_id: null, generation: '',
};
type MarriageRow = { id: number; husband_id: number; wife_id: number; husband_name: string; wife_name: string; order_no: number };

export function MemberForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const all = useApi<Row[]>('/admin/members');
  const detail = useApi<any>(isNew ? null : `/admin/members/${id}`);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [spouseOpen, setSpouseOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (isNew) {
      setF({
        ...EMPTY,
        father_id: sp.get('father') ? Number(sp.get('father')) : null,
        mother_id: sp.get('mother') ? Number(sp.get('mother')) : null,
        gender: sp.get('gender') === 'female' ? 'female' : 'male',
        is_blood: sp.get('inlaw') !== '1',
      });
    } else if (detail.data) {
      const d = detail.data;
      const s = (v: unknown) => (v == null ? '' : String(v));
      setF({
        full_name: d.full_name, alias: s(d.alias), gender: d.gender, father_id: d.father_id, mother_id: d.mother_id,
        birth_order: s(d.birth_order), is_blood: !!d.is_blood, is_deceased: !!d.is_deceased, birth_date: s(d.birth_date),
        death_date: s(d.death_date), death_lunar_day: s(d.death_lunar_day), death_lunar_month: s(d.death_lunar_month),
        branch: s(d.branch), hometown: s(d.hometown), occupation: s(d.occupation), burial_place: s(d.burial_place),
        bio: s(d.bio), photo_file_id: d.photo_file_id, generation: s(d.generation),
      });
    }
  }, [isNew, detail.data, sp]);

  const members = all.data ?? [];
  const self = isNew ? null : Number(id);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.full_name.trim()) e.full_name = 'Nhập họ tên.';
    if (f.birth_date && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(f.birth_date)) e.birth_date = 'Dạng YYYY hoặc YYYY-MM-DD.';
    if (f.death_date && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(f.death_date)) e.death_date = 'Dạng YYYY hoặc YYYY-MM-DD.';
    if (!!f.death_lunar_day !== !!f.death_lunar_month) e.death_lunar = 'Cần đủ cả ngày và tháng.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async (e: FormEvent, then?: 'child') => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const n = (v: string) => (v === '' ? null : Number(v));
    const body = {
      ...f, birth_order: n(f.birth_order), death_lunar_day: n(f.death_lunar_day), death_lunar_month: n(f.death_lunar_month),
      generation: n(f.generation), is_blood: f.is_blood ? 1 : 0, is_deceased: f.is_deceased ? 1 : 0,
      spouse_id: isNew ? (sp.get('spouse') ? Number(sp.get('spouse')) : null) : undefined,
    };
    try {
      let newId = self;
      if (isNew) newId = (await api.post<{ id: number }>('/admin/members', body)).id;
      else await api.put(`/admin/members/${id}`, body);
      toast('Đã lưu.');
      all.reload();
      if (then === 'child') nav(`/admin/members/new?${f.gender === 'male' ? 'father' : 'mother'}=${newId}`);
      else if (isNew) nav(`/admin/members/${newId}`, { replace: true });
      else detail.reload();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const fillLunar = () => {
    const m = f.death_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return toast('Cần ngày mất dương lịch đầy đủ (YYYY-MM-DD).', 'error');
    const l = solarToLunar(Number(m[3]), Number(m[2]), Number(m[1]));
    setF((x) => ({ ...x, death_lunar_day: String(l.day), death_lunar_month: String(l.month) }));
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

  return (
    <>
      <nav className="text-sm text-ink-2 mb-3"><Link to="/admin/members" className="hover:text-accent">Thành viên</Link></nav>
      <PageHeader title={isNew ? 'Thêm thành viên' : f.full_name || 'Thành viên'}
        subtitle={!isNew && f.generation ? `Đời thứ ${f.generation}` : undefined}
        actions={!isNew ? <a href={`/thanh-vien/${id}`} target="_blank" className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium hover:bg-sunken">Xem trang</a> : undefined} />

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate>
        <div className="space-y-6">
          <Section title="Thông tin chính">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên" htmlFor="fn" error={errors.full_name} className="sm:col-span-2">
                <Input id="fn" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} aria-invalid={!!errors.full_name} />
              </Field>
              <Field label="Tên khác (tự, húy, thụy)" htmlFor="al"><Input id="al" value={f.alias} onChange={(e) => set('alias', e.target.value)} /></Field>
              <Field label="Giới tính" htmlFor="g">
                <Select id="g" value={f.gender} onChange={(e) => set('gender', e.target.value as any)}>
                  <option value="male">Nam</option><option value="female">Nữ</option>
                </Select>
              </Field>
              <div className="sm:col-span-2 flex flex-wrap gap-x-6">
                <Checkbox label="Người mang huyết thống dòng họ" checked={f.is_blood} onChange={(v) => set('is_blood', v)} />
                <Checkbox label="Đã mất" checked={f.is_deceased} onChange={(v) => set('is_deceased', v)} />
              </div>
            </div>
          </Section>

          <Section title="Cha mẹ" hint="Đời được tính tự động từ cha hoặc mẹ. Dâu, rể lấy theo đời của vợ hoặc chồng.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cha" htmlFor="fa">
                <MemberPicker id="fa" members={members} value={f.father_id} onChange={(v) => set('father_id', v)}
                  filter={(m) => m.gender === 'male' && m.id !== self} />
              </Field>
              <Field label="Mẹ" htmlFor="mo">
                <MemberPicker id="mo" members={members} value={f.mother_id} onChange={(v) => set('mother_id', v)}
                  filter={(m) => m.gender === 'female' && m.id !== self} />
              </Field>
              <Field label="Con thứ mấy" htmlFor="bo" hint="Dùng để xếp anh em và tính vai trên dưới.">
                <Input id="bo" type="number" min={1} value={f.birth_order} onChange={(e) => set('birth_order', e.target.value)} />
              </Field>
              {!f.father_id && !f.mother_id && f.is_blood && (
                <Field label="Đời thứ" htmlFor="gen" hint="Chỉ cần nhập với thủy tổ hoặc người chưa rõ cha mẹ.">
                  <Input id="gen" type="number" min={1} value={f.generation} onChange={(e) => set('generation', e.target.value)} />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Ngày tháng">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ngày sinh" htmlFor="bd" error={errors.birth_date} hint="YYYY-MM-DD, hoặc chỉ năm.">
                <Input id="bd" placeholder="1950 hoặc 1950-03-21" value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
              </Field>
              {f.is_deceased && (
                <>
                  <Field label="Ngày mất (dương lịch)" htmlFor="dd" error={errors.death_date}>
                    <Input id="dd" placeholder="2015-04-21" value={f.death_date} onChange={(e) => set('death_date', e.target.value)} />
                  </Field>
                  <Field label="Ngày giỗ (âm lịch)" htmlFor="ld" error={errors.death_lunar} className="sm:col-span-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input id="ld" type="number" min={1} max={30} placeholder="Ngày" className="w-24" value={f.death_lunar_day}
                        onChange={(e) => set('death_lunar_day', e.target.value)} aria-label="Ngày âm lịch" />
                      <span className="text-ink-2">tháng</span>
                      <Input type="number" min={1} max={12} placeholder="Tháng" className="w-24" value={f.death_lunar_month}
                        onChange={(e) => set('death_lunar_month', e.target.value)} aria-label="Tháng âm lịch" />
                      <Button type="button" size="sm" variant="ghost" onClick={fillLunar}>Tính từ ngày mất</Button>
                    </div>
                  </Field>
                  <Field label="Nơi an táng" htmlFor="bp" className="sm:col-span-2">
                    <Input id="bp" value={f.burial_place} onChange={(e) => set('burial_place', e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          </Section>

          <Section title="Thông tin thêm">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Chi / nhánh" htmlFor="br"><Input id="br" value={f.branch} onChange={(e) => set('branch', e.target.value)} /></Field>
              <Field label="Quê quán" htmlFor="ht"><Input id="ht" value={f.hometown} onChange={(e) => set('hometown', e.target.value)} /></Field>
              <Field label="Nghề nghiệp" htmlFor="oc"><Input id="oc" value={f.occupation} onChange={(e) => set('occupation', e.target.value)} /></Field>
              <Field label="Tiểu sử" htmlFor="bio" hint="Hỗ trợ Markdown: ## tiêu đề, **đậm**, - danh sách." className="sm:col-span-3">
                <Textarea id="bio" rows={6} value={f.bio} onChange={(e) => set('bio', e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          <Section title="Ảnh chân dung">
            <ImageUpload value={f.photo_file_id} onChange={(v) => set('photo_file_id', v)} label="Ảnh" round />
          </Section>
          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" loading={busy}>{isNew ? 'Thêm thành viên' : 'Lưu thay đổi'}</Button>
            <Button type="button" disabled={busy} onClick={(e) => save(e as any, 'child')}>Lưu và thêm con</Button>
          </div>
          {!isNew && (
            <>
              <Section title="Vợ / chồng">
                {!marriages.length && <p className="text-sm text-ink-3 mb-3">Chưa có.</p>}
                <ul className="space-y-2 mb-3">
                  {marriages.map((mr) => {
                    const otherId = mr.husband_id === self ? mr.wife_id : mr.husband_id;
                    const name = mr.husband_id === self ? mr.wife_name : mr.husband_name;
                    return (
                      <li key={mr.id} className="flex items-center gap-2 text-[15px]">
                        <Link to={`/admin/members/${otherId}`} className="flex-1 hover:text-accent truncate">{name}</Link>
                        {marriages.length > 1 && <Badge>Thứ {mr.order_no}</Badge>}
                        <button type="button" aria-label={`Gỡ quan hệ với ${name}`} className="size-8 rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger cursor-pointer"
                          onClick={async () => { await api.del(`/admin/marriages/${mr.id}`); detail.reload(); }}>×</button>
                      </li>
                    );
                  })}
                </ul>
                <Button type="button" size="sm" onClick={() => setSpouseOpen(true)}>Thêm vợ / chồng</Button>
              </Section>
              <Section title={`Con (${children.length})`}>
                <ul className="space-y-1 mb-3">
                  {children.map((c) => (
                    <li key={c.id}><Link to={`/admin/members/${c.id}`} className="text-[15px] hover:text-accent">{c.full_name}</Link></li>
                  ))}
                </ul>
                <Link to={`/admin/members/new?${f.gender === 'male' ? 'father' : 'mother'}=${self}${marriages.length === 1 ? `&${f.gender === 'male' ? 'mother' : 'father'}=${marriages[0].husband_id === self ? marriages[0].wife_id : marriages[0].husband_id}` : ''}`}
                  className="h-8 px-3 inline-flex items-center rounded-lg border border-line-strong bg-surface text-sm font-medium hover:bg-sunken">
                  Thêm con
                </Link>
              </Section>
              <Button type="button" variant="danger" onClick={() => setDelOpen(true)}>Xóa thành viên</Button>
            </>
          )}
        </div>
      </form>

      {!isNew && self && (
        <SpouseModal open={spouseOpen} onClose={() => setSpouseOpen(false)} self={self} gender={f.gender} members={members}
          nextOrder={marriages.length + 1} onDone={() => { setSpouseOpen(false); detail.reload(); all.reload(); }} />
      )}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Xóa thành viên?"
        footer={<>
          <Button onClick={() => setDelOpen(false)}>Hủy</Button>
          <Button variant="danger" onClick={() => remove(children.length > 0)}>Xóa</Button>
        </>}>
        <p className="text-ink-2">
          Xóa <b className="text-ink">{f.full_name}</b> khỏi phả đồ. Thao tác này không hoàn tác được.
          {children.length > 0 && <> Người này có <b className="text-ink">{children.length} người con</b>; các con sẽ mất liên kết cha/mẹ và hiện như một nhánh riêng.</>}
        </p>
      </Modal>
    </>
  );
}

function SpouseModal({ open, onClose, self, gender, members, nextOrder, onDone }: {
  open: boolean; onClose: () => void; self: number; gender: 'male' | 'female'; members: MemberBrief[]; nextOrder: number; onDone: () => void;
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [order, setOrder] = useState(String(nextOrder));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const other = gender === 'male' ? 'female' : 'male';
  useEffect(() => { setOrder(String(nextOrder)); }, [nextOrder]);
  const submit = async () => {
    setBusy(true);
    try {
      let sid = pick;
      if (mode === 'new') {
        if (!name.trim()) throw new Error('Nhập họ tên.');
        sid = (await api.post<{ id: number }>('/admin/members', { full_name: name, gender: other, is_blood: 0, is_deceased: 0 })).id;
      }
      if (!sid) throw new Error('Chọn một người.');
      await api.post('/admin/marriages', { a: self, b: sid, order_no: Number(order) || 1 });
      toast('Đã thêm.');
      setName('');
      setPick(null);
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={gender === 'male' ? 'Thêm vợ' : 'Thêm chồng'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy} onClick={submit}>Thêm</Button></>}>
      <div className="space-y-4">
        <div role="radiogroup" className="inline-flex p-1 rounded-lg bg-sunken">
          {([['new', 'Người mới (dâu/rể)'], ['existing', 'Người đã có trong phả']] as const).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
              className={`h-9 px-3 rounded-md text-sm font-medium cursor-pointer ${mode === k ? 'bg-surface shadow-sm' : 'text-ink-2'}`}>{l}</button>
          ))}
        </div>
        {mode === 'new' ? (
          <Field label="Họ và tên" htmlFor="sn" hint="Có thể bổ sung thông tin chi tiết sau trong hồ sơ của người này.">
            <Input id="sn" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        ) : (
          <Field label="Chọn người" htmlFor="sp"><MemberPicker id="sp" members={members} value={pick} onChange={setPick} filter={(m) => m.gender === other} /></Field>
        )}
        <Field label="Thứ tự (vợ cả = 1)" htmlFor="so">
          <Input id="so" type="number" min={1} className="w-28" value={order} onChange={(e) => setOrder(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      {hint && <p className="text-sm text-ink-3 mt-0.5">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
