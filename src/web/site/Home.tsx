import { Link } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { ArticleBrief, UpcomingEvent } from '../lib/types.ts';
import { Container, useSite } from './SiteLayout.tsx';
import { EmptyState, Skeleton } from '../components/ui.tsx';
import { EventRow } from './Events.tsx';

export function Home() {
  const { site } = useSite();
  const articles = useApi<ArticleBrief[]>('/articles?limit=4');
  const events = useApi<UpcomingEvent[]>('/events/upcoming?days=120');

  return (
    <>
      <section className="relative border-b border-line overflow-hidden">
        {site.banner_file_id && (
          <img src={fileUrl(site.banner_file_id)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        )}
        <Container className="relative py-12 sm:py-20 lg:py-24">
          <p className="text-gold font-medium tracking-wide uppercase text-sm">{site.site_tagline}</p>
          <h1 className="mt-3 font-serif text-[2rem] sm:text-5xl font-semibold text-ink leading-tight max-w-3xl">{site.site_name}</h1>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-ink-2 max-w-2xl leading-relaxed whitespace-pre-line">{site.intro}</p>
          <div className="mt-8 grid grid-cols-2 sm:flex gap-3">
            <Link to="/pha-do" className="h-12 px-6 inline-flex items-center justify-center rounded-lg bg-accent text-white font-medium hover:bg-accent-hover">
              Xem phả đồ
            </Link>
            <Link to="/bai-viet" className="h-12 px-6 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-ink font-medium hover:bg-sunken">
              Đọc phả ký
            </Link>
          </div>
        </Container>
      </section>

      <Container className="py-10 sm:py-12 grid gap-10 lg:gap-12 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        <section aria-labelledby="h-articles">
          <div className="flex items-baseline justify-between mb-5">
            <h2 id="h-articles" className="font-serif text-2xl font-semibold">Bài viết mới</h2>
            <Link to="/bai-viet" className="text-sm font-medium text-accent hover:underline">Tất cả</Link>
          </div>
          {articles.loading ? (
            <div className="grid gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : !articles.data?.length ? (
            <EmptyState title="Chưa có bài viết" text="Ban quản trị sẽ cập nhật phả ký và lịch sử dòng họ tại đây." />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {articles.data.map((a) => (
                <li key={a.id}>
                  <Link to={`/bai-viet/${a.slug}`} className="flex gap-4 py-5 group">
                    {a.cover_file_id && <img src={fileUrl(a.cover_file_id)} alt="" className="w-20 h-16 sm:w-28 sm:h-20 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0">
                      {a.category_name && <p className="text-xs font-medium text-gold uppercase tracking-wide">{a.category_name}</p>}
                      <h3 className="mt-1 font-semibold text-ink group-hover:text-accent">{a.title}</h3>
                      {a.summary && <p className="mt-1 text-sm text-ink-2 line-clamp-2">{a.summary}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="h-events">
          <div className="flex items-baseline justify-between mb-5">
            <h2 id="h-events" className="font-serif text-2xl font-semibold">Sắp tới</h2>
            <Link to="/su-kien" className="text-sm font-medium text-accent hover:underline">Lịch đầy đủ</Link>
          </div>
          {events.loading ? (
            <Skeleton className="h-48" />
          ) : !events.data?.length ? (
            <EmptyState title="Không có sự kiện trong 4 tháng tới" />
          ) : (
            <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
              {events.data.slice(0, 6).map((e) => <EventRow key={e.id} e={e} compact />)}
            </ul>
          )}
          {site.locked && !site.unlocked && (
            <p className="mt-3 text-sm text-ink-3">Ngày giỗ chỉ hiển thị sau khi nhập mã bảo mật ở trang Phả đồ.</p>
          )}
        </section>
      </Container>

      {(site.address || site.map_embed) && (
        <Container className="pb-4">
          <section aria-labelledby="h-map" className="rounded-xl border border-line bg-surface overflow-hidden">
            <div className="p-5">
              <h2 id="h-map" className="font-serif text-xl font-semibold">Nhà thờ họ</h2>
              {site.address && <p className="mt-1 text-ink-2">{site.address}</p>}
            </div>
            {site.map_embed && (
              <iframe title="Bản đồ nhà thờ họ" className="w-full h-80 border-0" loading="lazy"
                src={site.map_embed.startsWith('http') ? site.map_embed : `https://www.google.com/maps?q=${encodeURIComponent(site.map_embed)}&output=embed`} />
            )}
          </section>
        </Container>
      )}
    </>
  );
}
