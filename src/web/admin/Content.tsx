import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fileUrl, shrinkImage, useApi } from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import { CalendarDays, Check, FileText, Images, MapPin, Pencil, Plus, Repeat, Save, Trash2, UploadCloud } from 'lucide-react';
import {
  Badge, Button, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Modal, PageHeader, Pagination, Segmented, TableCard, usePageSize, Select, Spinner, Switch, Textarea, cx, useToast,
} from '../components/ui.tsx';
import { ImageUpload, useMe } from './AdminLayout.tsx';
import { Section } from './Members.tsx';
import { EventDatePicker, convertEventDate } from '../components/DateInput.tsx';
import { slugify } from '../../shared/slug.ts';
const RichEditor = lazy(() => import('../components/RichEditor.tsx'));

// ================= Articles =================
export function ArticlesAdmin() {
  const { data, error, loading, reload } = useApi<any[]>('/admin/articles');
  const [size, setSize] = usePageSize('articles');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'all' | '1' | '2' | '0'>('all');
  const list = (data ?? []).filter((a) => status === 'all' || String(a.published) === status);
  const count = (v: number) => (data ?? []).filter((a) => a.published === v).length;
  useEffect(() => setPage(0), [status]);
  const badge = (a: any) => (a.published === 1 ? <Badge tone="success">Đã đăng</Badge> : a.published === 2 ? <Badge tone="gold">Chờ duyệt</Badge> : <Badge>Nháp</Badge>);
  return (
    <>
      <PageHeader title="Bài viết" subtitle={data ? `${data.length} bài` : undefined}
        actions={<LinkButton to="/admin/articles/new" variant="primary" icon={<Plus aria-hidden />}>Viết bài</LinkButton>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<FileText />} title="Chưa có bài viết" text="Phả ký, lời nói đầu, lịch sử nhà thờ họ nên viết thành bài."
          action={<LinkButton to="/admin/articles/new" variant="primary" icon={<Plus aria-hidden />}>Viết bài đầu tiên</LinkButton>} />
      ) : (
        <>
          <div className="mb-4">
            <Segmented label="Lọc theo trạng thái" size="sm" value={status} onChange={setStatus}
              options={[{ value: 'all', label: `Tất cả ${data.length}` }, { value: '1', label: `Đã đăng ${count(1)}` }, { value: '2', label: `Chờ duyệt ${count(2)}` }, { value: '0', label: `Nháp ${count(0)}` }]} />
          </div>
          <TableCard footer={<Pagination page={page} size={size} total={list.length} onPage={setPage} onSize={setSize} unit="bài" />}>
            {!list.length && <p className="p-8 text-center text-ink-2">Không có bài nào ở trạng thái này.</p>}
            <ul className="md:hidden divide-y divide-line">
              {list.slice(page * size, page * size + size).map((a) => (
                <li key={a.id}>
                  <Link to={`/admin/articles/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent-soft/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      <p className="text-sm text-ink-2 truncate">{a.category_name ?? 'Chưa phân loại'} · {formatDate(a.updated_at.slice(0, 10))}</p>
                    </div>
                    {badge(a)}
                  </Link>
                </li>
              ))}
            </ul>
            {!!list.length && (
              <table className="gp-table hidden md:table w-full text-[15px]">
                <thead className="text-left text-sm text-ink-2">
                  <tr>
                    <th className="font-medium px-4 h-11">Tiêu đề</th>
                    <th className="font-medium px-4">Chuyên mục</th>
                    <th className="font-medium px-4">Người viết</th>
                    <th className="font-medium px-4">Cập nhật</th>
                    <th className="font-medium px-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.slice(page * size, page * size + size).map((a) => (
                    <tr key={a.id} className="h-13 transition-colors hover:bg-accent-soft/60">
                      <td className="px-4 py-2 max-w-[28rem]">
                        <Link to={`/admin/articles/${a.id}`} className="flex items-center gap-3 font-medium text-ink hover:text-accent">
                          <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><FileText className="size-4" /></span>
                          <span className="truncate">{a.title}</span>
                        </Link>
                      </td>
                      <td className="px-4 text-sm text-ink-2 whitespace-nowrap">{a.category_name ?? 'Chưa phân loại'}</td>
                      <td className="px-4 text-sm text-ink-2 whitespace-nowrap">{a.author_name || '—'}</td>
                      <td className="px-4 text-sm text-ink-2 whitespace-nowrap tabular-nums">{formatDate(a.updated_at.slice(0, 10))}</td>
                      <td className="px-4">{badge(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableCard>
        </>
      )}
    </>
  );
}

export function ArticleForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const toast = useToast();
  const cats = useApi<{ id: number; name: string }[]>('/admin/categories');
  const detail = useApi<any>(isNew ? null : `/admin/articles/${id}`);
  const isAdmin = useMe()?.role === 'admin';
  // 0 nháp, 1 đã đăng, 2 chờ duyệt. Biên tập viên chỉ chọn được nháp hoặc gửi duyệt.
  const [f, setF] = useState({ title: '', slug: '', summary: '', content: '', category_id: '' as string | number, cover_file_id: null as number | null, published: (isAdmin ? 1 : 2) as 0 | 1 | 2 });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (detail.data) {
      const d = detail.data;
      setF({ title: d.title, slug: d.slug, summary: d.summary ?? '', content: d.content ?? '', category_id: d.category_id ?? '', cover_file_id: d.cover_file_id, published: ([0, 1, 2].includes(d.published) ? d.published : 1) as 0 | 1 | 2 });
    }
  }, [detail.data]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return toast('Nhập tiêu đề.', 'error');
    setBusy(true);
    try {
      const body = { ...f, category_id: f.category_id || null };
      let saved: 0 | 1 | 2;
      if (isNew) {
        const r = await api.post<{ id: number; published: 0 | 1 | 2 }>('/admin/articles', body);
        saved = r.published;
        nav(`/admin/articles/${r.id}`, { replace: true });
      } else {
        const r = await api.put<{ slug: string; published: 0 | 1 | 2 }>(`/admin/articles/${id}`, body);
        saved = r.published;
        setF((x) => ({ ...x, slug: r.slug, published: r.published }));
      }
      toast(saved === 2 ? 'Đã lưu. Bài đang chờ quản trị viên duyệt.' : saved === 1 ? 'Đã lưu và đăng.' : 'Đã lưu bản nháp.');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  if (detail.loading) return <Loading />;
  return (
    <>
      <PageHeader back={[{ to: '/admin/articles', label: 'Bài viết' }]} title={isNew ? 'Viết bài mới' : f.title.trim() || 'Sửa bài viết'}
        actions={!isNew && f.published === 1 ? <a href={`/bai-viet/${f.slug}`} target="_blank" className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium hover:bg-sunken">Xem bài</a> : undefined} />
      <form onSubmit={save} className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px] max-w-[88rem] max-lg:pb-20">
        <div className="space-y-4 min-w-0">
          <Field label="Tiêu đề" htmlFor="t" required aside={`${f.title.length}/120`}>
            <Input id="t" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} className="text-lg h-12" placeholder="Ví dụ: Lịch sử nhà thờ họ" />
          </Field>
          <Field label="Tóm tắt" htmlFor="s" optional aside={`${f.summary.length}/200`} hint="Hiện ở danh sách bài viết và khi chia sẻ link.">
            <Textarea id="s" rows={2} maxLength={200} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          </Field>
          <div>
            <p className="text-sm font-medium mb-1.5">Nội dung</p>
            <Suspense fallback={<div className="h-96 rounded-lg border border-line-strong bg-surface animate-pulse" />}>
              <RichEditor value={f.content} onChange={(v) => setF((x) => ({ ...x, content: v }))} minHeight={420} placeholder="Viết nội dung bài..." />
            </Suspense>
          </div>
        </div>
        <div className="space-y-4 lg:sticky lg:top-6 self-start">
          <Section title="Xuất bản">
            <div className="space-y-3">
              <Field label="Chuyên mục" htmlFor="c">
                <Select id="c" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
                  <option value="">Không phân loại</option>
                  {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Trạng thái" hint={f.published === 1 ? 'Ai cũng đọc được.' : f.published === 2
                ? (isAdmin ? 'Chưa hiện trên website. Chọn Đã đăng rồi Lưu để duyệt bài.' : 'Chưa hiện trên website. Quản trị viên sẽ duyệt rồi đăng.')
                : 'Bản nháp, chỉ người quản lý thấy.'}>
                <Segmented label="Trạng thái" size="sm" value={String(f.published)} onChange={(v) => setF({ ...f, published: Number(v) as 0 | 1 | 2 })}
                  options={isAdmin
                    ? [{ value: '0', label: 'Nháp' }, { value: '2', label: 'Chờ duyệt' }, { value: '1', label: 'Đã đăng' }]
                    : [{ value: '0', label: 'Nháp' }, { value: '2', label: 'Gửi duyệt' }]} />
              </Field>
              <details className="group">
                <summary className="text-sm text-ink-2 cursor-pointer min-h-9 flex items-center hover:text-ink">Đường dẫn bài viết</summary>
                <Field label="Đường dẫn (slug)" htmlFor="sl" className="mt-1"
                  hint={<span className="break-all">/bai-viet/{f.slug || slugify(f.title) || '...'}</span>}>
                  <Input id="sl" value={f.slug} placeholder={slugify(f.title)} onChange={(e) => setF({ ...f, slug: e.target.value })} />
                </Field>
              </details>
              <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:bg-surface/95 max-lg:backdrop-blur max-lg:border-t max-lg:border-line max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button type="submit" variant="primary" className="w-full" icon={<Save aria-hidden />} loading={busy}>Lưu</Button>
              </div>
            </div>
          </Section>
          <Section title="Ảnh bìa"><ImageUpload value={f.cover_file_id} onChange={(v) => setF({ ...f, cover_file_id: v })} label="Ảnh bìa" /></Section>
          {!isNew && <Button type="button" variant="danger" className="w-full" icon={<Trash2 aria-hidden />} onClick={() => setDel(true)}>Xóa bài</Button>}
        </div>
      </form>
      <Modal open={del} onClose={() => setDel(false)} title="Xóa bài viết?"
        footer={<><Button onClick={() => setDel(false)}>Hủy</Button><Button variant="danger" onClick={async () => { await api.del(`/admin/articles/${id}`); nav('/admin/articles'); }}>Xóa</Button></>}>
        <p className="text-ink-2">Bài “{f.title}” sẽ bị xóa vĩnh viễn.</p>
      </Modal>
    </>
  );
}

// ================= Events =================
type Ev = { id?: number; title: string; description: string; calendar: 'solar' | 'lunar'; day: number | null; month: number | null; year: number | null; recurring: boolean; location: string };
const EV0: Ev = { title: '', description: '', calendar: 'lunar', day: null, month: null, year: null, recurring: true, location: '' };

export function EventsAdmin() {
  const { data, error, loading, reload } = useApi<any[]>('/admin/events');
  const [edit, setEdit] = useState<Ev | null>(null);
  const [removing, setRemoving] = useState<any | null>(null);
  const [errs, setErrs] = useState<{ title?: string; date?: string }>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const open = (e: Ev) => { setErrs({}); setEdit(e); };
  const save = async () => {
    if (!edit) return;
    const er = { title: edit.title.trim() ? undefined : 'Nhập tên sự kiện.', date: edit.day && edit.month ? undefined : 'Chọn một ngày trên lịch.' };
    setErrs(er);
    if (er.title) return document.getElementById('et')?.focus();
    if (er.date) return;
    setBusy(true);
    try {
      const body = { ...edit, recurring: edit.recurring ? 1 : 0, year: edit.recurring ? null : edit.year };
      if (edit.id) await api.put(`/admin/events/${edit.id}`, body);
      else await api.post('/admin/events', body);
      toast(edit.id ? 'Đã lưu sự kiện.' : 'Đã thêm sự kiện.');
      setEdit(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const when = (e: any) => `${e.calendar === 'lunar' ? `${e.day}/${e.month} âm lịch` : `${e.day}/${e.month}`}${e.year && !e.recurring ? `, năm ${e.year}` : ''}`;
  return (
    <>
      <PageHeader title="Sự kiện" subtitle="Lễ tế, họp họ, ngày kỷ niệm. Ngày giỗ tự lấy từ hồ sơ thành viên."
        actions={<Button variant="primary" icon={<Plus aria-hidden />} onClick={() => open({ ...EV0 })}>Thêm sự kiện</Button>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<CalendarDays />} title="Chưa có sự kiện" text="Thêm lễ tế xuân, họp họ hoặc ngày kỷ niệm. Sự kiện âm lịch tự đổi sang ngày dương mỗi năm."
          action={<Button variant="primary" icon={<Plus aria-hidden />} onClick={() => open({ ...EV0 })}>Thêm sự kiện</Button>} />
      ) : (
        <ul className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
          {data.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3 hover:bg-sunken/50 transition-colors">
              <span aria-hidden className="shrink-0 w-12 rounded-lg bg-sunken py-1.5 text-center">
                <span className="block text-[11px] leading-none text-ink-2">Th {e.month}</span>
                <span className="block mt-1 font-serif text-xl font-semibold leading-none">{e.day}</span>
              </span>
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium">{e.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                  <span>{when(e)}</span>
                  {!!e.recurring && <span className="inline-flex items-center gap-1"><Repeat aria-hidden className="size-3.5" />Hằng năm</span>}
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-3.5" />{e.location}</span>}
                </p>
              </div>
              <Button size="sm" icon={<Pencil aria-hidden />} onClick={() => open({ ...e, day: Number(e.day), month: Number(e.month), year: e.year ? Number(e.year) : null, recurring: !!e.recurring, description: e.description ?? '', location: e.location ?? '' })}>Sửa</Button>
              <Button size="sm" variant="ghost" className="hover:text-danger" icon={<Trash2 aria-hidden />} aria-label={`Xóa ${e.title}`} onClick={() => setRemoving(e)} />
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Sửa sự kiện' : 'Thêm sự kiện'} width="max-w-3xl"
        footer={<><Button onClick={() => setEdit(null)}>Hủy</Button><Button variant="primary" icon={<Check aria-hidden />} loading={busy} onClick={save}>Lưu sự kiện</Button></>}>
        {edit && (
          <form className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,1fr)_21rem]" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="space-y-4 md:order-1">
              <Field label="Tên sự kiện" htmlFor="et" required error={errs.title}>
                <Input id="et" value={edit.title} aria-invalid={!!errs.title} placeholder="Ví dụ: Lễ tế xuân"
                  onChange={(e) => { setEdit({ ...edit, title: e.target.value }); if (errs.title) setErrs({ ...errs, title: undefined }); }} />
              </Field>
              <Switch label="Lặp lại hằng năm" checked={edit.recurring} onChange={(v) => setEdit({ ...edit, recurring: v })}
                description={edit.recurring ? 'Mỗi năm tự hiện lại đúng ngày này.' : 'Chỉ diễn ra một lần, đúng năm đã chọn trên lịch.'} />
              {edit.recurring && (
                <div>
                  <p id="ecal" className="text-sm font-medium text-ink mb-1.5">Lặp theo</p>
                  <Segmented label="Lặp theo" size="sm" value={edit.calendar}
                    onChange={(c) => setEdit({ ...edit, ...convertEventDate({ calendar: edit.calendar, day: edit.day, month: edit.month, year: edit.year }, c) })}
                    options={[{ value: 'lunar', label: 'Ngày âm lịch' }, { value: 'solar', label: 'Ngày dương lịch' }]} />
                  <p className="mt-1.5 text-sm text-ink-2">{edit.calendar === 'lunar' ? 'Dùng cho giỗ, lễ tế. Ngày dương mỗi năm một khác.' : 'Dùng cho ngày kỷ niệm cố định theo dương lịch.'}</p>
                </div>
              )}
              <Field label="Địa điểm" htmlFor="el" optional><Input id="el" value={edit.location} placeholder="Nhà thờ họ" onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
              <Field label="Mô tả" htmlFor="eds" optional><Textarea id="eds" rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            </div>
            <div className="md:order-2">
              <p className="text-sm font-medium text-ink mb-1.5">Ngày<span className="text-danger ml-0.5" aria-hidden>*</span></p>
              <EventDatePicker recurring={edit.recurring} invalid={!!errs.date}
                value={{ calendar: edit.calendar, day: edit.day, month: edit.month, year: edit.year }}
                onChange={(v) => { setEdit({ ...edit, ...v }); if (errs.date) setErrs({ ...errs, date: undefined }); }} />
              {errs.date && <p role="alert" className="mt-1.5 text-sm text-danger">{errs.date}</p>}
            </div>
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Xóa sự kiện?"
        footer={<><Button onClick={() => setRemoving(null)}>Hủy</Button><Button variant="danger" icon={<Trash2 aria-hidden />} onClick={async () => {
          try { await api.del(`/admin/events/${removing.id}`); toast('Đã xóa sự kiện.'); reload(); } catch (e: any) { toast(e.message, 'error'); }
          setRemoving(null);
        }}>Xóa</Button></>}>
        <p className="text-ink-2">Sự kiện <b className="text-ink">{removing?.title}</b> sẽ bị xóa khỏi lịch.</p>
      </Modal>
    </>
  );
}

// ================= Albums =================
export function AlbumsAdmin() {
  const { data, error, loading, reload } = useApi<any[]>('/albums');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const nav = useNavigate();
  const create = async () => {
    if (!title.trim()) return;
    const r = await api.post<{ id: number }>('/admin/albums', { title });
    nav(`/admin/albums/${r.id}`);
  };
  return (
    <>
      <PageHeader title="Album ảnh" actions={<Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setOpen(true)}>Tạo album</Button>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? <EmptyState icon={<Images />} title="Chưa có album" text="Gom ảnh lễ tế, họp họ, ảnh tư liệu theo từng album."
        action={<Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setOpen(true)}>Tạo album</Button>} /> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.map((a) => (
            <li key={a.id}>
              <Link to={`/admin/albums/${a.id}`} className="gp-card group block rounded-xl border border-line bg-surface overflow-hidden">
                <div className="aspect-[4/3] bg-sunken overflow-hidden flex items-center justify-center text-line-strong">{a.cover ? <img src={fileUrl(a.cover)} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" /> : <Images aria-hidden className="size-10" />}</div>
                <div className="p-4"><p className="font-medium">{a.title}</p><p className="text-sm text-ink-2">{a.photo_count} ảnh</p></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Tạo album"
        footer={<><Button onClick={() => setOpen(false)}>Hủy</Button><Button variant="primary" onClick={create}>Tạo</Button></>}>
        <Field label="Tên album" htmlFor="at"><Input id="at" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} /></Field>
      </Modal>
    </>
  );
}

export function AlbumAdmin() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, reload } = useApi<any>(`/albums/${id}`);
  const [meta, setMeta] = useState({ title: '', description: '' });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => { if (data) setMeta({ title: data.title, description: data.description ?? '' }); }, [data]);
  const upload = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setProgress({ done: 0, total: list.length });
    const ids: number[] = [];
    let failed = 0;
    for (const f of list) {
      try {
        ids.push((await api.upload(await shrinkImage(f, 2000))).id);
      } catch {
        failed++;
      }
      setProgress((p) => p && { ...p, done: p.done + 1 });
    }
    if (ids.length) await api.post(`/admin/albums/${id}/photos`, { file_ids: ids });
    setProgress(null);
    toast(failed ? `Tải lên ${ids.length} ảnh, lỗi ${failed} ảnh.` : `Đã tải lên ${ids.length} ảnh.`, failed ? 'error' : 'success');
    reload();
  };
  if (loading) return <Loading />;
  if (!data) return <ErrorState error="Không tìm thấy album." />;
  return (
    <>
      <PageHeader back={[{ to: '/admin/albums', label: 'Album ảnh' }]} title={data.title} actions={<Button variant="danger" onClick={async () => { if (confirm('Xóa album và toàn bộ ảnh trong album?')) { await api.del(`/admin/albums/${id}`); nav('/admin/albums'); } }}>Xóa album</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] items-end mb-6">
        <Field label="Tên album" htmlFor="t"><Input id="t" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
        <Field label="Mô tả" htmlFor="d"><Input id="d" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
        <Button onClick={async () => { await api.put(`/admin/albums/${id}`, meta); toast('Đã lưu.'); }}>Lưu</Button>
      </div>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={cx('flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-8 sm:py-10 px-4 text-center cursor-pointer mb-6',
          drag ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-sunken')}>
        {progress ? (
          <><Spinner /><span className="text-ink-2">Đang tải {progress.done}/{progress.total}...</span></>
        ) : (
          <><UploadCloud aria-hidden className="size-7 text-ink-2 mb-1" /><span className="font-medium"><span className="pointer-coarse:hidden">Kéo thả ảnh vào đây hoặc bấm để chọn</span><span className="hidden pointer-coarse:inline">Bấm để chọn ảnh</span></span><span className="text-sm text-ink-3">Ảnh được thu nhỏ còn tối đa 2000px trước khi tải lên.</span></>
        )}
        <input type="file" accept="image/*" multiple className="sr-only" disabled={!!progress} onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
      {!data.photos.length ? <EmptyState title="Album chưa có ảnh" /> : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {data.photos.map((p: any) => (
            <li key={p.id} className="rounded-lg border border-line bg-surface overflow-hidden">
              <img src={fileUrl(p.file_id)} alt="" className="w-full aspect-square object-cover" loading="lazy" />
              <div className="p-2 flex gap-1">
                <Input aria-label="Chú thích" placeholder="Chú thích" defaultValue={p.caption ?? ''} className="h-8 text-sm"
                  onBlur={(e) => e.target.value !== (p.caption ?? '') && api.put(`/admin/photos/${p.id}`, { caption: e.target.value })} />
                <button aria-label="Xóa ảnh" className="size-8 pointer-coarse:size-11 shrink-0 rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger cursor-pointer"
                  onClick={async () => { await api.del(`/admin/photos/${p.id}`); reload(); }}>×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
