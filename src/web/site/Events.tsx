import { Link } from 'react-router-dom';
import { useApi } from '../lib/api.ts';
import type { UpcomingEvent } from '../lib/types.ts';
import { daysUntil, lunarLabel, weekday } from '../lib/format.ts';
import { Container } from './SiteLayout.tsx';
import { Badge, EmptyState, ErrorState, Loading, PageHeader, cx } from '../components/ui.tsx';
import { useState } from 'react';

export function EventRow({ e, compact }: { e: UpcomingEvent; compact?: boolean }) {
  const [y, m, d] = e.next_date.split('-').map(Number);
  const left = daysUntil(e.next_date);
  return (
    <li className={cx('flex gap-3 sm:gap-4', compact ? 'p-4' : 'p-4 sm:p-5')}>
      <div className={cx('shrink-0 self-start w-14 text-center rounded-lg py-1.5', e.kind === 'gio' ? 'bg-sunken' : 'bg-accent-soft')}>
        <p className="text-xs text-ink-2">Th {m}</p>
        <p className={cx('font-serif text-2xl font-semibold leading-none mt-0.5', e.kind === 'gio' ? 'text-ink' : 'text-accent')}>{d}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-ink">
          {e.member_id ? <Link to={`/thanh-vien/${e.member_id}`} className="hover:text-accent">{e.title}</Link> : e.title}
        </p>
        <span className="shrink-0">
          {left === 0 ? <Badge tone="accent">Hôm nay</Badge> : left <= 7 ? <Badge tone="gold">{left} ngày nữa</Badge> : !compact && <Badge>{left} ngày</Badge>}
        </span>
        </div>
        <p className="text-sm text-ink-2 mt-0.5">
          {weekday(e.next_date)}, {d}/{m}/{y} · Âm lịch {lunarLabel(e.next_date)}
        </p>
        {!compact && (e.description || e.location) && (
          <p className="text-sm text-ink-2 mt-1">{[e.description, e.location].filter(Boolean).join(' · ')}</p>
        )}
      </div>
    </li>
  );
}

export function EventsPage() {
  const [filter, setFilter] = useState<'all' | 'event' | 'gio'>('all');
  const { data, error, loading, reload } = useApi<UpcomingEvent[]>('/events/upcoming?days=380');
  const list = (data ?? []).filter((e) => filter === 'all' || e.kind === filter);
  const byMonth = new Map<string, UpcomingEvent[]>();
  for (const e of list) {
    const k = e.next_date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }
  return (
    <Container size="text" className="py-10">
      <PageHeader title="Lịch sự kiện" subtitle="Lễ tế, họp họ và ngày giỗ trong 12 tháng tới. Ngày âm lịch đã quy đổi sang dương lịch." />
      <div role="tablist" className="flex sm:inline-flex p-1 rounded-lg bg-sunken mb-6">
        {([['all', 'Tất cả'], ['event', 'Sự kiện'], ['gio', 'Ngày giỗ']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cx('flex-1 sm:flex-none h-9 pointer-coarse:h-10 px-4 rounded-md text-sm font-medium cursor-pointer', filter === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink')}>
            {l}
          </button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !list.length ? (
        <EmptyState title="Không có sự kiện" text="Chưa có sự kiện nào trong 12 tháng tới." />
      ) : (
        <div className="space-y-8">
          {[...byMonth].map(([k, evs]) => (
            <section key={k}>
              <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-2">
                Tháng {Number(k.slice(5))}/{k.slice(0, 4)}
              </h2>
              <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
                {evs.map((e) => <EventRow key={e.id} e={e} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
