import { Link } from 'react-router-dom';
import { useApi } from '../lib/api.ts';
import type { UpcomingEvent } from '../lib/types.ts';
import { Badge, ErrorState, Loading, PageHeader } from '../components/ui.tsx';
import { EventRow } from '../site/Events.tsx';

type Stats = {
  members: number; living: number; deceased: number; generations: number; articles: number; events: number;
  albums: number; photos: number; storage: string; orphans: { id: number; full_name: string; generation: number }[];
};

export function Dashboard() {
  const { data: s, error, loading, reload } = useApi<Stats>('/admin/stats');
  const ev = useApi<UpcomingEvent[]>('/events/upcoming?days=30');
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
        <Link to="/admin/members/new" className="h-10 px-4 inline-flex items-center rounded-lg bg-accent text-white font-medium hover:bg-accent-hover">Thêm thành viên</Link>
      } />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {tiles.map(([l, v, sub]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <p className="text-sm text-ink-2">{l}</p>
            <p className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums">{v}</p>
            <p className="mt-1 text-sm text-ink-3">{sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2 2xl:grid-cols-[3fr_2fr]">
        <section className="rounded-xl border border-line bg-surface">
          <h2 className="px-5 h-14 flex items-center font-semibold border-b border-line">30 ngày tới</h2>
          {ev.loading ? <Loading /> : !ev.data?.length ? <p className="p-5 text-ink-3">Không có sự kiện hay ngày giỗ nào.</p> : (
            <ul className="divide-y divide-line">{ev.data.slice(0, 8).map((e) => <EventRow key={e.id} e={e} compact />)}</ul>
          )}
        </section>
        <section className="rounded-xl border border-line bg-surface">
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
      </div>
    </>
  );
}
