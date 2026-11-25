import { useEffect, useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import { MENU_PAGES, defaultMenu, type MenuItem } from '../../shared/menu.ts';
import { Badge, Button, ErrorState, Field, Input, Loading, PageHeader, Select, Switch, useToast } from '../components/ui.tsx';
import { Section } from './Members.tsx';

type Data = { items: MenuItem[]; categories: { slug: string; name: string }[] };
const keyOf = (i: MenuItem) => `${i.type}:${i.target}`;

/** Menu của trang xem: đổi tên, ẩn hiện, sắp thứ tự, thêm chuyên mục hoặc liên kết ngoài. */
export function MenuAdmin() {
  const { data, error, loading, reload } = useApi<Data>('/admin/menu');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState('');
  const [link, setLink] = useState({ label: '', target: '' });
  const [linkErr, setLinkErr] = useState('');
  const [moved, setMoved] = useState('');
  const toast = useToast();
  useEffect(() => { if (data) setItems(data.items); }, [data]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? 'Lỗi'} onRetry={reload} />;

  const dirty = JSON.stringify(items) !== JSON.stringify(data.items);
  const set = (i: number, p: Partial<MenuItem>) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setItems((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l];
    [n[i], n[j]] = [n[j], n[i]];
    setMoved(`${n[j].label} chuyển tới vị trí ${j + 1}`);
    return n;
  });
  const save = async () => {
    if (items.some((i) => !i.label.trim())) return toast('Có mục chưa có tên hiển thị.', 'error');
    setBusy(true);
    try { await api.put('/admin/menu', { items }); toast('Đã lưu menu.'); reload(); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const freeCats = data.categories.filter((c) => !items.some((i) => i.type === 'category' && i.target === c.slug));
  const addLink = () => {
    const target = link.target.trim();
    if (!link.label.trim()) return setLinkErr('Nhập tên hiển thị.');
    if (!/^https?:\/\/\S+$/i.test(target) && !/^\/\S*$/.test(target)) return setLinkErr('Địa chỉ bắt đầu bằng https:// hoặc dấu / (trang trong website).');
    if (items.some((i) => i.type === 'link' && i.target === target)) return setLinkErr('Liên kết này đã có trong menu.');
    setItems((l) => [...l, { type: 'link', target, label: link.label.trim().slice(0, 40), visible: true }]);
    setLink({ label: '', target: '' }); setLinkErr('');
  };
  const shown = items.filter((i) => i.visible).length;

  return (
    <>
      <PageHeader title="Menu website" subtitle="Thanh menu ở đầu trang xem"
        actions={<>
          <Button onClick={() => setItems(defaultMenu())}>Về mặc định</Button>
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>Lưu menu</Button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem] items-start max-w-[72rem]">
        <Section title={`Các mục (${shown} đang hiện)`} hint="Dùng nút Lên và Xuống để đổi thứ tự. Trên điện thoại menu hiện dạng danh sách dọc, nên giữ tối đa 7 mục.">
          <p className="sr-only" role="status">{moved}</p>
          <ol className="divide-y divide-line -mx-1">
            {items.map((it, i) => {
              const isHome = it.type === 'page' && it.target === 'home';
              return (
                <li key={keyOf(it)} className="px-1 py-3 grid gap-x-3 gap-y-2 grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto] items-center">
                  <div className="min-w-0">
                    <Input aria-label={`Tên hiển thị của mục ${i + 1}`} value={it.label} maxLength={40} onChange={(e) => set(i, { label: e.target.value })} />
                    <p className="mt-1 text-sm text-ink-2 truncate">
                      {it.type === 'page' ? <>Trang có sẵn · {MENU_PAGES[it.target].to}</>
                        : it.type === 'category' ? <>Chuyên mục · {data.categories.find((c) => c.slug === it.target)?.name ?? 'đã bị xóa, sẽ không hiện'}</>
                        : <>Liên kết · {it.target}</>}
                    </p>
                  </div>
                  <div className="flex gap-1 row-span-2 sm:row-span-1 self-start sm:self-center">
                    <Button size="sm" disabled={i === 0} aria-label={`Đưa ${it.label} lên`} onClick={() => move(i, -1)}>Lên</Button>
                    <Button size="sm" disabled={i === items.length - 1} aria-label={`Đưa ${it.label} xuống`} onClick={() => move(i, 1)}>Xuống</Button>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    {isHome ? <Badge>Luôn hiện</Badge> : <Switch label="Hiện" checked={it.visible} onChange={(v) => set(i, { visible: v })} />}
                    {it.type !== 'page' && <Button size="sm" variant="ghost" className="text-danger" aria-label={`Gỡ ${it.label} khỏi menu`}
                      onClick={() => setItems((l) => l.filter((_, k) => k !== i))}>Gỡ</Button>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
        <div className="space-y-6">
          <Section title="Thêm chuyên mục" hint="Đưa một chuyên mục bài viết lên menu, ví dụ Thông báo.">
            {!freeCats.length ? <p className="text-sm text-ink-2">Mọi chuyên mục đã có trong menu.</p> : (
              <div className="flex gap-2">
                <Select aria-label="Chuyên mục" value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">Chọn chuyên mục</option>
                  {freeCats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </Select>
                <Button disabled={!cat} onClick={() => {
                  const c = freeCats.find((x) => x.slug === cat)!;
                  setItems((l) => [...l, { type: 'category', target: c.slug, label: c.name.slice(0, 40), visible: true }]); setCat('');
                }}>Thêm</Button>
              </div>
            )}
          </Section>
          <Section title="Thêm liên kết" hint="Ví dụ nhóm Zalo của họ, trang Facebook, hoặc một bài viết cụ thể.">
            <div className="space-y-3">
              <Field label="Tên hiển thị" htmlFor="ml-label"><Input id="ml-label" maxLength={40} value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} /></Field>
              <Field label="Địa chỉ" htmlFor="ml-url" error={linkErr || undefined}>
                <Input id="ml-url" inputMode="url" placeholder="https://..." value={link.target} onChange={(e) => setLink({ ...link, target: e.target.value })} aria-invalid={!!linkErr} />
              </Field>
              <Button onClick={addLink}>Thêm vào menu</Button>
            </div>
          </Section>
        </div>
      </div>
      {dirty && <p className="mt-4 text-sm text-ink-2" role="status">Có thay đổi chưa lưu.</p>}
    </>
  );
}
