import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import { api, fileUrl, shrinkImage, useApi } from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import { lunarToSolar, solarToLunar } from '../../shared/lunar.ts';
import {
  Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Spinner, Textarea, cx, useToast,
} from '../components/ui.tsx';
import { ImageUpload } from './AdminLayout.tsx';
import { Section } from './Members.tsx';

// ================= Articles =================
export function ArticlesAdmin() {
  const { data, error, loading, reload } = useApi<any[]>('/admin/articles');
  return (
    <>
      <PageHeader title="Bài viết" actions={<Link to="/admin/articles/new" className="h-10 px-4 inline-flex items-center rounded-lg bg-accent text-white font-medium hover:bg-accent-hover">Viết bài</Link>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="Chưa có bài viết" text="Phả ký, lời nói đầu, lịch sử nhà thờ họ... đều nên là bài viết." />
      ) : (
        <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
          {data.map((a) => (
            <li key={a.id}>
              <Link to={`/admin/articles/${a.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-sunken/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.title}</p>
                  <p className="text-sm text-ink-2">{a.category_name ?? 'Chưa phân loại'} · {formatDate(a.updated_at.slice(0, 10))}</p>
                </div>
                {a.published ? <Badge tone="success">Đã đăng</Badge> : <Badge>Nháp</Badge>}
              </Link>
            </li>
          ))}
        </ul>
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
  const [f, setF] = useState({ title: '', slug: '', summary: '', content: '', category_id: '' as string | number, cover_file_id: null as number | null, published: true });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  useEffect(() => {
    if (detail.data) {
      const d = detail.data;
      setF({ title: d.title, slug: d.slug, summary: d.summary ?? '', content: d.content ?? '', category_id: d.category_id ?? '', cover_file_id: d.cover_file_id, published: !!d.published });
    }
  }, [detail.data]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return toast('Nhập tiêu đề.', 'error');
    setBusy(true);
    try {
      const body = { ...f, category_id: f.category_id || null, published: f.published ? 1 : 0 };
      if (isNew) {
        const r = await api.post<{ id: number }>('/admin/articles', body);
        nav(`/admin/articles/${r.id}`, { replace: true });
      } else {
        const r = await api.put<{ slug: string }>(`/admin/articles/${id}`, body);
        setF((x) => ({ ...x, slug: r.slug }));
      }
      toast('Đã lưu.');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const insertImage = async (file?: File) => {
    if (!file) return;
    setImgBusy(true);
    try {
      const r = await api.upload(await shrinkImage(file));
      setF((x) => ({ ...x, content: `${x.content}\n\n![${file.name}](${fileUrl(r.id)})\n` }));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setImgBusy(false);
    }
  };
  if (detail.loading) return <Loading />;
  return (
    <>
      <nav className="text-sm text-ink-2 mb-3"><Link to="/admin/articles" className="hover:text-accent">Bài viết</Link></nav>
      <PageHeader title={isNew ? 'Viết bài mới' : 'Sửa bài viết'}
        actions={!isNew && f.published ? <a href={`/bai-viet/${f.slug}`} target="_blank" className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium hover:bg-sunken">Xem bài</a> : undefined} />
      <form onSubmit={save} className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_300px] max-lg:pb-20">
        <div className="space-y-4 min-w-0">
          <Field label="Tiêu đề" htmlFor="t"><Input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="text-lg h-12" /></Field>
          <Field label="Tóm tắt" htmlFor="s"><Textarea id="s" rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="text-sm font-medium">Nội dung</span>
              <div className="flex items-center gap-1">
                <label className="h-8 px-3 inline-flex items-center gap-2 rounded-lg text-sm text-ink-2 hover:bg-sunken cursor-pointer">
                  {imgBusy && <Spinner className="size-4" />} Chèn ảnh
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => insertImage(e.target.files?.[0])} />
                </label>
                <div className="inline-flex p-0.5 rounded-lg bg-sunken">
                  {[false, true].map((p) => (
                    <button key={String(p)} type="button" onClick={() => setPreview(p)}
                      className={cx('h-7 px-3 rounded-md text-sm cursor-pointer', preview === p ? 'bg-surface shadow-sm font-medium' : 'text-ink-2')}>
                      {p ? 'Xem trước' : 'Soạn'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {preview ? (
              <div className="min-h-80 sm:min-h-96 rounded-lg border border-line bg-surface p-4 sm:p-6 prose-gp" dangerouslySetInnerHTML={{ __html: marked.parse(f.content, { async: false }) as string }} />
            ) : (
              <Textarea aria-label="Nội dung (Markdown)" rows={20} className="w-full font-mono text-sm min-h-80 sm:min-h-96" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })}
                placeholder={'## Tiêu đề mục\n\nĐoạn văn...\n\n- Ý 1\n- Ý 2'} />
            )}
            <p className="mt-1.5 text-sm text-ink-3">Markdown: ## tiêu đề, **đậm**, *nghiêng*, - danh sách, &gt; trích dẫn.</p>
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
              <Field label="Đường dẫn (slug)" htmlFor="sl" hint="Để trống sẽ tạo từ tiêu đề.">
                <Input id="sl" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
              </Field>
              <Checkbox label="Hiển thị công khai" checked={f.published} onChange={(v) => setF({ ...f, published: v })} />
              <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:bg-surface/95 max-lg:backdrop-blur max-lg:border-t max-lg:border-line max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button type="submit" variant="primary" className="w-full" loading={busy}>Lưu</Button>
              </div>
            </div>
          </Section>
          <Section title="Ảnh bìa"><ImageUpload value={f.cover_file_id} onChange={(v) => setF({ ...f, cover_file_id: v })} label="Ảnh bìa" /></Section>
          {!isNew && <Button type="button" variant="danger" className="w-full" onClick={() => setDel(true)}>Xóa bài</Button>}
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
type Ev = { id?: number; title: string; description: string; calendar: 'solar' | 'lunar'; day: number | string; month: number | string; year: number | string | null; recurring: boolean; location: string };
const EV0: Ev = { title: '', description: '', calendar: 'lunar', day: '', month: '', year: '', recurring: true, location: '' };

export function EventsAdmin() {
  const { data, error, loading, reload } = useApi<any[]>('/admin/events');
  const [edit, setEdit] = useState<Ev | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const body = { ...edit, recurring: edit.recurring ? 1 : 0, year: edit.recurring ? null : Number(edit.year) || null };
      if (edit.id) await api.put(`/admin/events/${edit.id}`, body);
      else await api.post('/admin/events', body);
      toast('Đã lưu.');
      setEdit(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const hint = (() => {
    if (!edit?.day || !edit?.month) return '';
    const y = new Date().getFullYear();
    if (edit.calendar === 'lunar') {
      const s = lunarToSolar(Number(edit.day), Number(edit.month), Number(edit.year) || y);
      return s ? `Năm ${Number(edit.year) || y} rơi vào ngày ${s[0]}/${s[1]}/${s[2]} dương lịch.` : '';
    }
    const l = solarToLunar(Number(edit.day), Number(edit.month), Number(edit.year) || y);
    return `Tương ứng ${l.day}/${l.month} âm lịch.`;
  })();
  return (
    <>
      <PageHeader title="Sự kiện" subtitle="Lễ tế, họp họ, ngày kỷ niệm. Ngày giỗ được tạo tự động từ hồ sơ thành viên."
        actions={<Button variant="primary" onClick={() => setEdit({ ...EV0 })}>Thêm sự kiện</Button>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="Chưa có sự kiện" />
      ) : (
        <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
          {data.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-ink-2">{e.day}/{e.month}{e.year && !e.recurring ? `/${e.year}` : ''} {e.calendar === 'lunar' ? 'âm lịch' : 'dương lịch'}{e.recurring ? ', hằng năm' : ''}{e.location ? ` · ${e.location}` : ''}</p>
              </div>
              <Button size="sm" onClick={() => setEdit({ ...e, recurring: !!e.recurring, description: e.description ?? '', location: e.location ?? '' })}>Sửa</Button>
              <Button size="sm" variant="ghost" aria-label={`Xóa ${e.title}`} onClick={async () => { if (confirm(`Xóa “${e.title}”?`)) { await api.del(`/admin/events/${e.id}`); reload(); } }}>Xóa</Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Sửa sự kiện' : 'Thêm sự kiện'}
        footer={<><Button onClick={() => setEdit(null)}>Hủy</Button><Button variant="primary" loading={busy} onClick={save}>Lưu</Button></>}>
        {edit && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
            <Field label="Tên sự kiện" htmlFor="et" className="col-span-2 sm:col-span-3"><Input id="et" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Lịch" htmlFor="ec" className="col-span-2 sm:col-span-1">
              <Select id="ec" value={edit.calendar} onChange={(e) => setEdit({ ...edit, calendar: e.target.value as any })}>
                <option value="lunar">Âm lịch</option><option value="solar">Dương lịch</option>
              </Select>
            </Field>
            <Field label="Ngày" htmlFor="ed"><Input id="ed" type="number" min={1} max={31} value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })} /></Field>
            <Field label="Tháng" htmlFor="em"><Input id="em" type="number" min={1} max={12} value={edit.month} onChange={(e) => setEdit({ ...edit, month: e.target.value })} /></Field>
            <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-4">
              <Checkbox label="Lặp lại hằng năm" checked={edit.recurring} onChange={(v) => setEdit({ ...edit, recurring: v })} />
              {!edit.recurring && <Input aria-label="Năm" placeholder="Năm" type="number" className="w-28" value={edit.year ?? ''} onChange={(e) => setEdit({ ...edit, year: e.target.value })} />}
            </div>
            {hint && <p className="col-span-2 sm:col-span-3 text-sm text-ink-2 -mt-2">{hint}</p>}
            <Field label="Địa điểm" htmlFor="el" className="col-span-2 sm:col-span-3"><Input id="el" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
            <Field label="Mô tả" htmlFor="eds" className="col-span-2 sm:col-span-3"><Textarea id="eds" rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          </div>
        )}
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
      <PageHeader title="Album ảnh" actions={<Button variant="primary" onClick={() => setOpen(true)}>Tạo album</Button>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? <EmptyState title="Chưa có album" /> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => (
            <li key={a.id}>
              <Link to={`/admin/albums/${a.id}`} className="block rounded-xl border border-line bg-surface overflow-hidden hover:shadow-sm">
                <div className="aspect-[4/3] bg-sunken">{a.cover && <img src={fileUrl(a.cover)} alt="" className="w-full h-full object-cover" />}</div>
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
      <nav className="text-sm text-ink-2 mb-3"><Link to="/admin/albums" className="hover:text-accent">Album ảnh</Link></nav>
      <PageHeader title={data.title} actions={<Button variant="danger" onClick={async () => { if (confirm('Xóa album và toàn bộ ảnh trong album?')) { await api.del(`/admin/albums/${id}`); nav('/admin/albums'); } }}>Xóa album</Button>} />
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
          <><span className="font-medium"><span className="pointer-coarse:hidden">Kéo thả ảnh vào đây hoặc bấm để chọn</span><span className="hidden pointer-coarse:inline">Bấm để chọn ảnh</span></span><span className="text-sm text-ink-3">Ảnh được thu nhỏ còn tối đa 2000px trước khi tải lên.</span></>
        )}
        <input type="file" accept="image/*" multiple className="sr-only" disabled={!!progress} onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
      {!data.photos.length ? <EmptyState title="Album chưa có ảnh" /> : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
