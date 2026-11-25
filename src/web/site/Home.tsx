import { Link } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { ArticleBrief, UpcomingEvent } from '../lib/types.ts';
import { ArrowRight, BookOpen, CalendarDays, FileText, Images, MapPin, Network } from 'lucide-react';
import type { Site } from '../lib/types.ts';
import type { TemplateId } from '../../shared/site.ts';
import { Container, useSite } from './SiteLayout.tsx';
import { EmptyState, Skeleton, cx } from '../components/ui.tsx';
import { EventRow } from './Events.tsx';
import { RichContent } from '../components/RichContent.tsx';

const btn = 'group h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[.98]';

/** Phần đầu trang chủ. Mỗi mẫu một cách trình bày, nội dung như nhau. */
function Hero({ site, template }: { site: Site; template: TemplateId }) {
  const banner = template !== 'toi-gian' && site.banner_file_id ? fileUrl(site.banner_file_id) : null;
  const dark = template === 'trong-dong' || template === 'son';
  const centered = dark;
  const soft = template === 'trong-dong' ? 'text-cham-2' : template === 'son' ? 'text-son-2' : 'text-ink-2';
  const actions = (
    <div className={cx('mt-8 flex flex-wrap gap-3', centered && 'justify-center')}>
      <Link to="/pha-do" className={cx(btn, dark ? 'bg-white text-[#191919] hover:bg-[#ececea] hover:shadow-lg' : 'bg-accent text-white hover:bg-accent-hover hover:shadow-lg')}>
        <Network aria-hidden className="size-5" />Xem phả đồ<ArrowRight aria-hidden className="gp-arrow size-4" />
      </Link>
      <Link to="/bai-viet" className={cx(btn, dark ? 'border border-white/55 text-white hover:bg-white/10 hover:border-white' : 'border border-line-strong text-ink hover:bg-white/60 hover:border-ink')}>
        <BookOpen aria-hidden className="size-5" />Đọc phả ký
      </Link>
    </div>
  );
  const text = (
    <>
      {site.site_tagline && <p className={cx('font-serif italic text-lg', soft)}>{site.site_tagline}</p>}
      <h1 className={cx('mt-3 font-serif font-medium leading-[1.05] text-balance', template === 'toi-gian' ? 'text-5xl sm:text-7xl lg:text-8xl tracking-tight' : 'text-[2.75rem] sm:text-7xl')}>{site.site_name}</h1>
      {site.intro && <p className={cx('mt-5 text-base sm:text-lg max-w-xl leading-relaxed whitespace-pre-line', soft, centered && 'mx-auto')}>{site.intro}</p>}
      {actions}
    </>
  );

  if (template === 'giay-do')
    return (
      <section className="relative overflow-hidden bg-do text-ink border-b border-line">
        {banner
          ? <img src={banner} alt="" className="absolute inset-y-0 right-0 w-full lg:w-1/2 h-full object-cover opacity-25 lg:opacity-90 lg:[mask-image:linear-gradient(to_right,transparent,black_35%)]" />
          : <img src="/hoa-tiet/rong.webp" alt="" aria-hidden="true" className="gp-dragon absolute right-[-12%] sm:right-[-6%] top-1/2 -translate-y-1/2 w-[130%] sm:w-[58%] max-w-none opacity-25 lg:opacity-80" />}
        <Container className="relative py-20 sm:py-28 lg:py-32"><div className="lg:max-w-[44%]">{text}</div></Container>
      </section>
    );
  if (template === 'toi-gian')
    return (
      <section className="bg-bg text-ink">
        <Container className="pt-16 sm:pt-24 pb-12 sm:pb-16">
          {text}
          <hr className="mt-12 sm:mt-16 border-0 border-t border-line-strong" />
        </Container>
      </section>
    );
  return (
    <section className={cx('relative overflow-hidden text-white text-center', template === 'son' ? 'gp-lac' : 'bg-cham')}>
      {banner ? <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        : template === 'trong-dong' && <img src="/hoa-tiet/trong-dong.webp" alt="" aria-hidden="true" className="gp-drum absolute left-1/2 top-1/2 w-[max(820px,78vw)] max-w-none aspect-square" />}
      <div className={cx('absolute inset-0', template === 'son' ? 'gp-son-veil' : 'gp-hero-veil')} aria-hidden="true" />
      <Container className="relative py-20 sm:py-28 lg:py-36">{text}</Container>
    </section>
  );
}

export function Home() {
  const { site, template } = useSite();
  const articles = useApi<ArticleBrief[]>('/articles?limit=4');
  const events = useApi<UpcomingEvent[]>('/events/upcoming?days=120');
  const next = events.data?.[0];
  const QUICK = [
    { to: '/pha-do', icon: Network, label: 'Phả đồ', sub: 'Cây phả hệ các đời' },
    { to: '/bai-viet', icon: BookOpen, label: 'Phả ký', sub: 'Lịch sử, bài viết' },
    { to: '/su-kien', icon: CalendarDays, label: 'Sự kiện', sub: 'Lễ tế, ngày giỗ' },
    { to: '/album', icon: Images, label: 'Thư viện', sub: 'Ảnh tư liệu' },
  ];

  return (
    <>
      <Hero site={site} template={template} />

      {next && (
        <section className={cx('text-white', template === 'son' ? 'bg-cham' : 'gp-lac')} aria-label="Sự kiện gần nhất">
          <Container className="py-8 sm:py-10 flex flex-wrap items-center gap-x-10 gap-y-3">
            <p className="font-serif font-medium text-5xl sm:text-6xl leading-none whitespace-nowrap">
              {next.day} · {next.month}
              <span className={cx('block mt-2 font-sans text-sm font-medium', template === 'son' ? 'text-cham-2' : 'text-son-2')}>{next.calendar === 'lunar' ? 'Âm lịch' : 'Dương lịch'}</span>
            </p>
            <div className="min-w-0 flex-1 basis-64">
              <h2 className="font-serif font-medium text-2xl sm:text-3xl">{next.title}</h2>
              {next.location && <p className={cx('mt-1 inline-flex items-center gap-1.5', template === 'son' ? 'text-cham-2' : 'text-son-2')}><MapPin aria-hidden className="size-4" />{next.location}</p>}
            </div>
            <Link to="/su-kien" className={cx(btn, 'h-11 px-5 bg-white text-[#191919] hover:bg-[#ececea] hover:shadow-lg')}>
              <CalendarDays aria-hidden className="size-[18px]" />Xem lịch giỗ<ArrowRight aria-hidden className="gp-arrow size-4" />
            </Link>
          </Container>
        </section>
      )}

      {site.foreword && site.foreword.replace(/<[^>]*>/g, '').trim() && (
        <Container className="pt-10 sm:pt-14">
          <section aria-labelledby="h-foreword" className={cx('grid gap-6 lg:gap-10 items-start', site.intro_image_file_id && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
            {site.intro_image_file_id && <img src={fileUrl(site.intro_image_file_id)} alt="" className="w-full rounded-xl border border-line object-cover aspect-[4/3]" loading="lazy" />}
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-2 uppercase tracking-wide">Lời nói đầu</p>
              <h2 id="h-foreword" className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-ink">{site.site_name}</h2>
              <RichContent html={site.foreword} className="mt-4 max-w-prose" />
            </div>
          </section>
        </Container>
      )}

      <Container className="pt-8 sm:pt-10">
        <nav aria-label="Đi nhanh" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="gp-card group flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 sm:p-4">
              <span aria-hidden className="size-11 shrink-0 inline-flex items-center justify-center rounded-lg bg-sunken text-ink transition-colors group-hover:bg-accent group-hover:text-white"><q.icon className="size-5" strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{q.label}</span>
                <span className="block text-sm text-ink-2 truncate">{q.sub}</span>
              </span>
              <ArrowRight aria-hidden className="gp-arrow size-4 text-line-strong group-hover:text-ink max-sm:hidden" />
            </Link>
          ))}
        </nav>
      </Container>

      <Container className="py-10 sm:py-12 grid gap-10 lg:gap-12 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        <section aria-labelledby="h-articles">
          <div className="flex items-baseline justify-between mb-5">
            <h2 id="h-articles" className="font-serif text-2xl font-semibold">Bài viết mới</h2>
            <Link to="/bai-viet" className="group inline-flex items-center gap-1 min-h-9 text-sm font-medium text-ink-2 hover:text-ink">Tất cả<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>
          </div>
          {articles.loading ? (
            <div className="grid gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : !articles.data?.length ? (
            <EmptyState icon={<FileText />} title="Chưa có bài viết" text="Phả ký và lịch sử dòng họ sẽ được đăng ở đây." />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {articles.data.map((a) => (
                <li key={a.id}>
                  <Link to={`/bai-viet/${a.slug}`} className="flex gap-4 py-5 px-2 -mx-2 rounded-lg group hover:bg-sunken/60 transition-colors">
                    {a.cover_file_id && <span className="w-20 h-16 sm:w-28 sm:h-20 rounded-lg overflow-hidden shrink-0"><img src={fileUrl(a.cover_file_id)} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /></span>}
                    <div className="min-w-0">
                      {a.category_name && <p className="text-xs font-medium text-gold uppercase tracking-wide">{a.category_name}</p>}
                      <h3 className="mt-1 font-semibold text-ink group-hover:underline underline-offset-4">{a.title}</h3>
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
            <Link to="/su-kien" className="group inline-flex items-center gap-1 min-h-9 text-sm font-medium text-ink-2 hover:text-ink">Lịch đầy đủ<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>
          </div>
          {events.loading ? (
            <Skeleton className="h-48" />
          ) : !events.data?.length ? (
            <EmptyState icon={<CalendarDays />} title="Chưa có sự kiện sắp tới" />
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
              {site.address && <p className="mt-1 inline-flex items-start gap-1.5 text-ink-2"><MapPin aria-hidden className="size-4 mt-1 shrink-0" />{site.address}</p>}
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
