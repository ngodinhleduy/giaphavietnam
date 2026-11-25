import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/api.ts';
import type { Marriage, MemberBrief, UpcomingEvent } from '../lib/types.ts';
import { Badge, Button, ErrorState, Loading, PageHeader } from '../components/ui.tsx';
import { FamilyTree, useTreeModel, type FamilyTreeHandle, type TreeOptions } from '../components/FamilyTree.tsx';
import { EventRow } from '../site/Events.tsx';
import { logTime, type LogRow } from './Logs.tsx';
import { useMe } from './AdminLayout.tsx';

type Stats = {
  members: number; living: number; deceased: number; generations: number; articles: number; events: number;
  albums: number; photos: number; storage: string; unread: number; pending: number; orphans: { id: number; full_name: string; generation: number }[];
};

const SHORTCUTS = [
  { to: '/admin/members/new', label: 'Thêm thành viên', sub: 'Nhập hồ sơ đầy đủ' },
  { to: '/admin/members', label: 'Quản lý thành viên', sub: 'Danh sách, tìm và sửa' },
  { to: '/admin/articles/new', label: 'Viết bài', sub: 'Phả ký, tin tức' },
  { to: '/admin/events', label: 'Sự kiện, ngày giỗ', sub: 'Âm lịch tự đổi mỗi năm' },
  { to: '/admin/settings', label: 'Cấu hình website', sub: 'Tên trang, mã xem phả đồ', adminOnly: true },
];

export function Dashboard() {
  const { data: s, error, loading, reload } = useApi<Stats>('/admin/stats');
  const ev = useApi<UpcomingEvent[]>('/events/upcoming?days=30');
  const isAdmin = useMe()?.role === 'admin';
  const logs = useApi<{ rows: LogRow[]; total: number }>(isAdmin ? '/admin/logs?limit=6' : null);
  if (loading) return <Loading />;
  if (error || !s) return <ErrorState error={error ?? 'Lỗi'} onRetry={reload} />;
  const tiles = [
    ['Thành viên', s.members, `${s.living} còn sống · ${s.deceased} đã mất`],
    ['Số đời', s.generations || 0, 'Tính từ thủy tổ'],
    ['Bài viết', s.articles, 'Phả ký, lịch sử'],
    ['Ảnh', s.photos, `${s.albums} album`],
  ] as const;
  return (
    <>
      <PageHeader title="Tổng quan" actions={
        <Link to="/" className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium hover:bg-sunken">Xem website</Link>
      } />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {tiles.map(([l, v, sub]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <p className="text-sm text-ink-2">{l}</p>
            <p className="mt-1 font-serif text-3xl font-medium tabular-nums">{v}</p>
            <p className="mt-1 text-sm text-ink-3">{sub}</p>
          </div>
        ))}
      </div>

      {(s.pending > 0 || (isAdmin && s.unread > 0)) && (
        <div role="status" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-line-strong bg-sunken px-4 py-3">
          {s.pending > 0 && <Link to="/admin/articles" className="font-medium underline underline-offset-4">{s.pending} bài viết chờ duyệt</Link>}
          {isAdmin && s.unread > 0 && <Link to="/admin/messages" className="font-medium underline underline-offset-4">{s.unread} thư chưa đọc trong hòm thư</Link>}
        </div>
      )}

      <nav aria-label="Lối tắt" className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {SHORTCUTS.filter((x) => !('adminOnly' in x) || isAdmin).map((x) => (
          <Link key={x.to} to={x.to} className="rounded-lg border border-line bg-surface px-4 py-3 hover:bg-sunken hover:border-line-strong">
            <span className="block font-medium text-ink">{x.label}</span>
            <span className="block text-sm text-ink-2">{x.sub}</span>
          </Link>
        ))}
      </nav>

      <TreePreview />

      <div className={`mt-6 grid gap-6 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
        {isAdmin && <section className="rounded-xl border border-line bg-surface">
          <h2 className="px-5 h-14 flex items-center justify-between font-semibold border-b border-line">
            Lịch sử thao tác
            <Link to="/admin/logs" className="text-sm font-medium text-ink-2 hover:text-ink underline underline-offset-4 decoration-line-strong">Xem nhật ký</Link>
          </h2>
          {!logs.data?.rows.length ? <p className="p-5 text-ink-3">Chưa có thao tác nào được ghi.</p> : (
            <ul className="divide-y divide-line">
              {logs.data.rows.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <Link to="/admin/logs" className="block hover:underline underline-offset-4">{r.action}</Link>
                  <span className="text-sm text-ink-3 tabular-nums">{r.admin_name ? `Bởi ${r.admin_name} · ` : ''}{logTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>}
        <section className="rounded-xl border border-line bg-surface">
          <h2 className="px-5 h-14 flex items-center font-semibold border-b border-line">30 ngày tới</h2>
          {ev.loading ? <Loading /> : !ev.data?.length ? <p className="p-5 text-ink-3">Không có sự kiện hay ngày giỗ nào.</p> : (
            <ul className="divide-y divide-line">{ev.data.slice(0, 8).map((e) => <EventRow key={e.id} e={e} compact />)}</ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface">
        <h2 className="px-4 sm:px-5 py-3 min-h-14 flex flex-wrap items-center justify-between gap-2 font-semibold border-b border-line">
          Cần kiểm tra
          <Badge tone={s.storage === 'none' ? 'accent' : 'success'}>Storage: {s.storage === 'gdrive' ? 'Google Drive' : s.storage === 'local' ? 'Thư mục local/NAS' : 'chưa cấu hình'}</Badge>
        </h2>
        {!s.orphans.length ? <p className="p-5 text-ink-3">Dữ liệu ổn. Không có thành viên huyết thống nào bị thiếu cha mẹ.</p> : (
          <>
            <p className="px-5 pt-4 text-sm text-ink-2">Những người dưới đây thuộc đời 2 trở xuống nhưng chưa gắn cha hoặc mẹ, nên đang hiện như một gốc riêng trên cây.</p>
            <ul className="p-3">
              {s.orphans.map((o) => (
                <li key={o.id}><Link to={`/admin/members/${o.id}`} className="flex justify-between px-2 py-2 rounded-lg hover:bg-sunken">
                  <span>{o.full_name}</span><span className="text-sm text-ink-3">Đời {o.generation}</span>
                </Link></li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

/** Phả đồ thu gọn ngay trên Tổng quan: bấm một người để sang màn soạn phả đồ với người đó đã được chọn. */
function TreePreview() {
  const { data } = useApi<{ members: MemberBrief[]; marriages: Marriage[] }>('/tree');
  const nav = useNavigate();
  const ref = useRef<FamilyTreeHandle>(null);
  const model = useTreeModel(data?.members ?? [], data?.marriages ?? []);
  const [opt, setOpt] = useState<TreeOptions>({ hideSpouses: false, coupleLines: true, maxGen: 4, collapsed: new Set(), rootId: null });
  return (
    <section className="mt-6 rounded-xl border border-line bg-surface overflow-hidden">
      <h2 className="px-5 min-h-14 py-2 flex flex-wrap items-center justify-between gap-2 font-semibold border-b border-line">
        Phả đồ
        <span className="flex items-center gap-2">
          <Button size="sm" onClick={() => ref.current?.fit()}>Vừa khung</Button>
          <Link to="/admin/tree" className="h-8 pointer-coarse:h-10 px-3 inline-flex items-center rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover">Mở để soạn</Link>
        </span>
      </h2>
      {!data ? <Loading /> : !data.members.length ? (
        <p className="p-5 text-ink-3">Phả đồ chưa có ai. <Link to="/admin/members/new" className="text-ink underline underline-offset-4">Thêm thủy tổ</Link> để bắt đầu.</p>
      ) : (
        <div className="h-[420px]">
          <FamilyTree ref={ref} model={model} options={opt} selectedId={null} highlight={new Set()}
            onSelect={(id) => nav(`/admin/tree?m=${id}`)}
            onToggle={(id) => setOpt((o) => {
              const c = new Set(o.collapsed);
              const g = model.byId.get(id)?.generation ?? 1;
              if (o.maxGen && g >= o.maxGen) return { ...o, maxGen: null, collapsed: c };
              if (c.has(id)) c.delete(id); else c.add(id);
              return { ...o, collapsed: c };
            })} />
        </div>
      )}
    </section>
  );
}
