import { Link } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { ArticleBrief, UpcomingEvent } from '../lib/types.ts';
import { ArrowRight, BookOpen, CalendarDays, FileText, MapPin, Network } from 'lucide-react';
import type { Site } from '../lib/types.ts';
import { layoutOf, type TemplateId } from '../../shared/site.ts';
import { Featured, MapBlock, QUICK, SectionHead, btn, type HomeData } from './HomeParts.tsx';
import { Magazine, Monument, Scroll, Sidebar } from './HomeLayouts.tsx';
import { Container, useSite } from './SiteLayout.tsx';
import { EmptyState, Skeleton, cx } from '../components/ui.tsx';
import { EventRow } from './Events.tsx';
import { RichContent } from '../components/RichContent.tsx';


/** Phần đầu trang chủ. Mỗi mẫu một cách trình bày, nội dung như nhau. */
function Hero({ site, template, lift }: { site: Site; template: TemplateId; lift: boolean }) {
  const banner = template !== 'toi-gian' && site.banner_file_id ? fileUrl(site.banner_file_id) : null;
  const dark = template === 'trong-dong' || template === 'son';
  // Có ảnh banner: chữ dồn về bên trái, phía dưới, để phần lớn ảnh không bị che. Không có ảnh: chữ canh giữa trên họa tiết.
  const photo = dark && !!banner;
  const centered = dark && !photo;
  const soft = dark ? (template === 'son' && !photo ? 'text-son-2' : 'text-cham-2') : 'text-ink-2';
  const redOnRed = template === 'son' && !photo;
  // Trên nền tối, nút màu nhấn chỉ nổi khi màu nhấn là đỏ son trên ảnh. Các trường hợp còn lại dùng nút sáng để đủ tương phản với nền.
  const lightBtn = dark && !(template === 'son' && photo);
  const actions = (
    <div className={cx('mt-8 flex flex-wrap gap-3', centered && 'justify-center')}>
      <Link to="/pha-do" className={cx(btn, lightBtn ? 'bg-surface text-ink hover:bg-white hover:shadow-lg' : 'bg-accent text-white hover:bg-accent-hover hover:shadow-lg')}>
        <Network aria-hidden className="size-5" />Xem phả đồ<ArrowRight aria-hidden className="gp-arrow size-4" />
      </Link>
      <Link to="/bai-viet" className={cx(btn, dark ? 'border border-white/60 text-white hover:bg-white/10 hover:border-white' : 'border border-line-strong text-ink hover:bg-surface hover:border-ink')}>
        <BookOpen aria-hidden className="size-5" />Đọc phả ký
      </Link>
    </div>
  );
  const text = (
    <>
      {site.site_tagline && <p className={cx('font-serif italic text-lg sm:text-xl', dark ? (redOnRed ? 'text-son-2' : 'text-gold-bright') : 'text-gold')}>{site.site_tagline}</p>}
      <h1 className={cx('mt-3 font-serif font-medium leading-[1.08] text-balance', template === 'toi-gian' ? 'text-5xl sm:text-7xl lg:text-8xl tracking-tight' : 'text-[2.5rem] sm:text-6xl lg:text-7xl')}>{site.site_name}</h1>
      {site.intro && <p className={cx('mt-5 text-base sm:text-lg max-w-xl leading-relaxed whitespace-pre-line', soft, centered && 'mx-auto')}>{site.intro}</p>}
      {actions}
    </>
  );

  if (template === 'giay-do')
    return (
      <section className="relative overflow-hidden bg-do text-ink border-b border-line">
        {banner
          ? <img src={banner} alt="" className="absolute inset-y-0 right-0 w-full lg:w-1/2 h-full object-cover opacity-25 lg:opacity-100 lg:[mask-image:linear-gradient(to_right,transparent,black_30%)]" />
          : <img src="/hoa-tiet/rong.webp" alt="" aria-hidden="true" className="gp-dragon absolute right-[-12%] sm:right-[-6%] top-1/2 -translate-y-1/2 w-[130%] sm:w-[58%] max-w-none opacity-25 lg:opacity-80" />}
        <Container className={cx('relative pt-20 sm:pt-28 lg:pt-32', lift ? 'pb-36 sm:pb-44' : 'pb-20 sm:pb-28 lg:pb-32')}><div className="lg:max-w-[44%]">{text}</div></Container>
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
  if (photo)
    return (
      <section className="relative overflow-hidden bg-cham text-[#f6efe2]">
        <img src={banner!} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 gp-banner-veil" aria-hidden="true" />
        <Container className={cx('relative pt-44 sm:pt-56 lg:pt-36', lift ? 'pb-32 sm:pb-40 lg:pb-48' : 'pb-14 sm:pb-20 lg:pb-36')}>
          <div className="max-w-xl [text-shadow:0_1px_14px_rgb(0_0_0/0.45)] [&_a]:[text-shadow:none]">{text}</div>
        </Container>
      </section>
    );
  return (
    <section className={cx('relative overflow-hidden text-[#f6efe2] text-center', template === 'son' ? 'gp-lac' : 'bg-cham')}>
      {template === 'trong-dong' && <img src="/hoa-tiet/trong-dong.webp" alt="" aria-hidden="true" className="gp-drum absolute left-1/2 top-1/2 w-[max(820px,78vw)] max-w-none aspect-square" />}
      <div className={cx('absolute inset-0', template === 'son' ? 'gp-son-veil' : 'gp-hero-veil')} aria-hidden="true" />
      <Container className={cx('relative pt-20 sm:pt-28 lg:pt-36', lift ? 'pb-36 sm:pb-44 lg:pb-52' : 'pb-20 sm:pb-28 lg:pb-36')}>{text}</Container>
    </section>
  );
}

export function Home() {
  const { site, template } = useSite();
  const articles = useApi<ArticleBrief[]>('/articles?limit=9');
  const events = useApi<UpcomingEvent[]>('/events/upcoming?days=120');
  const next = events.data?.[0];
  // Bài nổi bật do quản trị viên chọn (tối đa 5). Chưa chọn bài nào thì lấy bài mới nhất.
  const picked = useApi<ArticleBrief[]>('/articles/featured');
  const slides = template === 'toi-gian' || picked.loading ? [] : picked.data?.length ? picked.data : (articles.data ?? []).slice(0, 1);
  const shown = new Set(slides.map((a) => a.id));
  const others = (articles.data ?? []).filter((a) => !shown.has(a.id));
  const rest = others.slice(0, 4);
  const hasForeword = !!site.foreword && !!site.foreword.replace(/<[^>]*>/g, '').trim();

  // Bốn mẫu bổ sung có bố cục riêng
  const layout = layoutOf(template);
  if (layout !== 'classic') {
    const d: HomeData = { site, loadingArticles: articles.loading || picked.loading, loadingEvents: events.loading, slides, rest: others, events: events.data ?? [], hasForeword };
    return layout === 'magazine' ? <Magazine {...d} /> : layout === 'monument' ? <Monument {...d} /> : layout === 'sidebar' ? <Sidebar {...d} /> : <Scroll {...d} />;
  }

  return (
    <>
      <Hero site={site} template={template} lift={slides.length > 0} />

      {slides.length > 0 && (
        <Container className="relative z-10 -mt-24 sm:-mt-28">
          <Featured items={slides} />
        </Container>
      )}

      <Container className="pt-12 sm:pt-16">
        <SectionHead id="h-quick" title="Khám phá gia phả" />
        <nav aria-labelledby="h-quick" className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="gp-card group flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
              <span aria-hidden className="size-12 inline-flex items-center justify-center rounded-lg bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white"><q.icon className="size-6" strokeWidth={1.6} /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-serif text-xl font-medium text-ink">{q.label}<ArrowRight aria-hidden className="gp-arrow size-4 text-accent" /></span>
                <span className="mt-0.5 block text-sm text-ink-2">{q.sub}</span>
              </span>
            </Link>
          ))}
        </nav>
      </Container>

      {hasForeword && (
        <Container className="pt-12 sm:pt-16">
          <section aria-labelledby="h-foreword" className={cx('grid overflow-hidden rounded-2xl border border-line bg-surface', site.intro_image_file_id && 'lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]')}>
            <div className="min-w-0 p-6 sm:p-10 lg:p-12">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">Lời nói đầu</p>
              <h2 id="h-foreword" className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-ink">{site.site_name}</h2>
              <RichContent html={site.foreword} className="mt-5 max-w-prose" />
            </div>
            {site.intro_image_file_id && <img src={fileUrl(site.intro_image_file_id)} alt="" className="w-full h-full min-h-64 object-cover max-lg:order-first max-lg:aspect-[16/10]" loading="lazy" />}
          </section>
        </Container>
      )}

      {next && (
        <section className={cx('mt-12 sm:mt-16 text-[#f6efe2]', template === 'son' ? 'bg-cham' : template === 'toi-gian' ? 'bg-son' : 'gp-lac')} aria-label="Sự kiện gần nhất">
          <Container className="py-8 sm:py-10 flex flex-wrap items-center gap-x-10 gap-y-3">
            <p className="font-serif font-medium text-5xl sm:text-6xl leading-none whitespace-nowrap">
              {next.day} · {next.month}
              <span className={cx('block mt-2 font-sans text-sm font-medium', template === 'son' ? 'text-cham-2' : 'text-son-2')}>{next.calendar === 'lunar' ? 'Âm lịch' : 'Dương lịch'}</span>
            </p>
            <div className="min-w-0 flex-1 basis-64">
              <h2 className="font-serif font-medium text-2xl sm:text-3xl">{next.title}</h2>
              {next.location && <p className={cx('mt-1 inline-flex items-center gap-1.5', template === 'son' ? 'text-cham-2' : 'text-son-2')}><MapPin aria-hidden className="size-4" />{next.location}</p>}
            </div>
            <Link to="/su-kien" className={cx(btn, 'h-11 px-5 bg-surface text-ink hover:bg-white hover:shadow-lg')}>
              <CalendarDays aria-hidden className="size-[18px]" />Xem lịch giỗ<ArrowRight aria-hidden className="gp-arrow size-4" />
            </Link>
          </Container>
        </section>
      )}

      <Container className="py-12 sm:py-16 grid gap-12 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_400px]">
        <section aria-labelledby="h-articles">
          <SectionHead id="h-articles" title="Phả ký" to="/bai-viet" more="Xem tất cả" />
          {articles.loading ? (
            <div className="grid gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : !articles.data?.length ? (
            <EmptyState icon={<FileText />} title="Chưa có bài viết" text="Phả ký và lịch sử dòng họ sẽ được đăng ở đây." />
          ) : !rest.length ? (
            <p className="text-ink-2">Các bài viết khác sẽ hiện ở đây.</p>
          ) : (
            <ul className="grid gap-4">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link to={`/bai-viet/${a.slug}`} className="gp-card group flex gap-4 sm:gap-5 rounded-xl border border-line bg-surface p-3 sm:p-4">
                    {a.cover_file_id && <span className="w-24 h-20 sm:w-40 sm:h-28 rounded-lg overflow-hidden shrink-0"><img src={fileUrl(a.cover_file_id)} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" /></span>}
                    <div className="min-w-0 self-center">
                      {a.category_name && <p className="text-xs font-semibold text-accent uppercase tracking-wider">{a.category_name}</p>}
                      <h3 className="mt-1 font-serif text-xl font-medium text-ink leading-snug group-hover:text-accent transition-colors">{a.title}</h3>
                      {a.summary && <p className="mt-1 text-sm text-ink-2 line-clamp-2">{a.summary}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="h-events">
          <SectionHead id="h-events" title="Sắp tới" to="/su-kien" more="Lịch" />
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

      <Container className="pb-4"><MapBlock site={site} /></Container>
    </>
  );
}
