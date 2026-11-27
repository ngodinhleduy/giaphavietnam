import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, MapPin, Network } from 'lucide-react';
import { fileUrl } from '../lib/api.ts';
import type { ArticleBrief, Site, UpcomingEvent } from '../lib/types.ts';
import { weekday } from '../lib/format.ts';
import { solarToLunar } from '../../shared/lunar.ts';
import { Container } from './SiteLayout.tsx';
import { Skeleton, cx } from '../components/ui.tsx';
import { EventRow } from './Events.tsx';
import { RichContent } from '../components/RichContent.tsx';
import { Featured, MapBlock, QUICK, SectionHead, btn, postDate, type HomeData } from './HomeParts.tsx';

// Bốn bố cục trang chủ bổ sung. Nội dung như nhau, cách sắp xếp khác hẳn nhau:
// Magazine (Gốm lam): chia đôi chữ và ảnh, lưới bài ba cột.
// Monument (Hoàng thành): ảnh lớn, khung chữ canh giữa, sự kiện theo trục thời gian.
// Sidebar (Ngói rêu): menu dọc bên trái (SiteLayout), một cột nội dung, lịch bám theo khi cuộn.
// Scroll (Mực tàu): cột hẹp canh giữa, danh sách chữ thay cho thẻ.

const initial = (site: Site) => site.site_name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || 'G';
const bannerOf = (site: Site) => (site.banner_file_id ? fileUrl(site.banner_file_id) : null);

/** Ngày dương của lần tới và ngày âm tương ứng */
function when(e: UpcomingEvent) {
  const [y, m, d] = e.next_date.split('-').map(Number);
  const lunar = e.calendar === 'lunar' ? { day: e.day, month: e.month } : solarToLunar(d, m, y);
  return { y, m, d, lunar };
}

function LockNote({ site, className }: { site: Site; className?: string }) {
  if (!site.locked || site.unlocked) return null;
  return <p className={cx('mt-3 text-sm text-ink-3', className)}>Ngày giỗ chỉ hiển thị sau khi nhập mã bảo mật ở trang Phả đồ.</p>;
}

/** Thẻ bài viết dọc: ảnh bìa ở trên, chữ ở dưới */
function PostCard({ a }: { a: ArticleBrief }) {
  return (
    <Link to={`/bai-viet/${a.slug}`} className="gp-card group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <span className="flex aspect-[16/10] items-center justify-center overflow-hidden bg-do">
        {a.cover_file_id
          ? <img src={fileUrl(a.cover_file_id)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" />
          : <BookOpen aria-hidden className="size-12 text-line-strong" strokeWidth={1} />}
      </span>
      <span className="flex flex-1 flex-col p-5">
        {a.category_name && <span className="text-xs font-semibold uppercase tracking-wider text-accent">{a.category_name}</span>}
        <span className="mt-1 font-serif text-xl font-medium leading-snug text-ink">{a.title}</span>
        {a.summary && <span className="mt-2 text-sm text-ink-2 line-clamp-2">{a.summary}</span>}
        <span className="mt-auto pt-4 text-sm text-ink-3">{postDate(a.created_at)}</span>
      </span>
    </Link>
  );
}

/** Dòng bài viết ngang: chữ bên trái, ảnh nhỏ bên phải */
function PostRow({ a, card }: { a: ArticleBrief; card?: boolean }) {
  return (
    <Link to={`/bai-viet/${a.slug}`} className={cx('group flex items-center gap-4', card ? 'gp-card h-full border border-line bg-surface p-4' : 'py-4')}>
      <span className="min-w-0 flex-1">
        {a.category_name && <span className="block text-xs font-semibold uppercase tracking-wider text-accent">{a.category_name}</span>}
        <span className="mt-1 block font-serif text-xl font-medium leading-snug text-ink underline-offset-4 group-hover:underline">{a.title}</span>
        {a.summary && <span className="mt-1 block text-sm text-ink-2 line-clamp-2">{a.summary}</span>}
      </span>
      {a.cover_file_id && <span className="h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-36"><img src={fileUrl(a.cover_file_id)} alt="" loading="lazy" className="h-full w-full object-cover" /></span>}
    </Link>
  );
}

const noPosts = <p className="text-ink-2">Phả ký và lịch sử dòng họ sẽ được đăng ở đây.</p>;
const noEvents = <p className="text-ink-2">Chưa có sự kiện sắp tới.</p>;

/* ===================== Gốm lam: tạp chí ===================== */
export function Magazine({ site, slides, rest, events, hasForeword, loadingArticles, loadingEvents }: HomeData) {
  const banner = bannerOf(site);
  return (
    <>
      <Container className="pt-8 sm:pt-12 lg:pt-16">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            {site.site_tagline && <p className="inline-flex min-h-8 items-center rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent">{site.site_tagline}</p>}
            <h1 className="mt-4 font-serif text-[2.5rem] font-medium leading-[1.08] text-balance text-ink sm:text-6xl xl:text-7xl">{site.site_name}</h1>
            {site.intro && <p className="mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-ink-2 sm:text-lg">{site.intro}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/pha-do" className={cx(btn, 'rounded-full bg-accent text-white hover:bg-accent-hover hover:shadow-lg')}><Network aria-hidden className="size-5" />Xem phả đồ<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>
              <Link to="/bai-viet" className={cx(btn, 'rounded-full border border-line-strong text-ink hover:border-ink hover:bg-surface')}><BookOpen aria-hidden className="size-5" />Đọc phả ký</Link>
            </div>
          </div>
          {banner
            ? <img src={banner} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-[0_30px_60px_-30px_rgb(19_42_107/0.55)]" />
            : <div aria-hidden className="gp-lac flex aspect-[4/3] items-center justify-center rounded-3xl font-serif text-[9rem] leading-none text-white/90">{initial(site)}</div>}
        </div>

        {/* Lối tắt: một thanh ngang chia bốn ô */}
        <nav aria-label="Khám phá gia phả" className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-4 lg:divide-x lg:divide-line max-lg:[&>a:nth-child(-n+2)]:border-b max-lg:[&>a:nth-child(odd)]:border-r max-lg:[&>a]:border-line">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="group flex items-center gap-3 p-4 transition-colors hover:bg-accent-soft sm:p-5">
              <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white"><q.icon className="size-5" strokeWidth={1.6} /></span>
              <span className="min-w-0">
                <span className="block font-serif text-lg font-medium text-ink">{q.label}</span>
                <span className="block text-sm text-ink-2 max-sm:hidden">{q.sub}</span>
              </span>
            </Link>
          ))}
        </nav>
      </Container>

      {slides.length > 0 && (
        <Container className="pt-12 sm:pt-16"><Featured items={slides} /></Container>
      )}

      <Container className="pt-12 sm:pt-16">
        <section aria-labelledby="h-articles">
          <SectionHead id="h-articles" title="Phả ký" to="/bai-viet" more="Xem tất cả" />
          {loadingArticles ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
            : !rest.length ? (slides.length ? <p className="text-ink-2">Các bài viết khác sẽ hiện ở đây.</p> : noPosts)
            : <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rest.slice(0, 6).map((a) => <li key={a.id}><PostCard a={a} /></li>)}</ul>}
        </section>
      </Container>

      {/* Sự kiện: dải nền chìm kín chiều ngang, thẻ xếp lưới */}
      <section aria-labelledby="h-events" className="mt-12 bg-sunken py-12 sm:mt-16 sm:py-16">
        <Container>
          <SectionHead id="h-events" title="Sắp tới" to="/su-kien" more="Xem lịch" />
          {loadingEvents ? <Skeleton className="h-32" /> : !events.length ? noEvents
            : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>li]:rounded-2xl [&>li]:border [&>li]:border-line [&>li]:bg-surface">{events.slice(0, 6).map((e) => <EventRow key={e.id} e={e} compact />)}</ul>}
          <LockNote site={site} />
        </Container>
      </section>

      {hasForeword && (
        <Container className="pt-12 sm:pt-16">
          <section aria-labelledby="h-foreword" className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-14">
            {site.intro_image_file_id
              ? <img src={fileUrl(site.intro_image_file_id)} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-3xl object-cover max-lg:aspect-[16/10]" />
              : <div aria-hidden className="gp-lac aspect-[4/5] rounded-3xl max-lg:hidden" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">Lời nói đầu</p>
              <h2 id="h-foreword" className="mt-2 font-serif text-3xl font-medium text-ink sm:text-4xl">{site.site_name}</h2>
              <RichContent html={site.foreword} className="mt-5 max-w-prose" />
            </div>
          </section>
        </Container>
      )}

      <Container className="pb-4 pt-12 sm:pt-16"><MapBlock site={site} /></Container>
    </>
  );
}

/* ===================== Hoàng thành: tượng đài ===================== */
/** Họa tiết phân cách: hai nét mảnh và một hình thoi ở giữa */
const Ornament = ({ className }: { className?: string }) => (
  <span aria-hidden className={cx('flex items-center justify-center gap-3', className)}>
    <span className="h-px w-12 bg-current opacity-60" /><span className="size-2 rotate-45 bg-current" /><span className="h-px w-12 bg-current opacity-60" />
  </span>
);

export function Monument({ site, slides, rest, events, hasForeword, loadingArticles, loadingEvents }: HomeData) {
  const banner = bannerOf(site);
  return (
    <>
      <section className={cx('relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden py-16 text-[#f6efe2]', banner ? 'bg-cham' : 'gp-lac')}>
        {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {/* Ảnh để gần như nguyên bản: chỉ phủ nhẹ ở mép, khung chữ có nền riêng nên chữ vẫn đủ tương phản */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(52_20_10/0.45)_100%)]" />
        <div className="gp-frame relative mx-6 max-w-2xl bg-cham/90 px-6 py-10 text-center sm:px-12 sm:py-14">
          <Ornament className="text-gold-bright" />
          {site.site_tagline && <p className="mt-5 font-serif text-lg italic text-gold-bright sm:text-xl">{site.site_tagline}</p>}
          <h1 className="mt-3 font-serif text-[2.5rem] font-medium leading-[1.1] text-balance sm:text-6xl">{site.site_name}</h1>
          {site.intro && <p className="mx-auto mt-5 max-w-xl whitespace-pre-line leading-relaxed text-cham-2 sm:text-lg">{site.intro}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/pha-do" className={cx(btn, 'bg-gold-bright text-cham hover:bg-white')}><Network aria-hidden className="size-5" />Xem phả đồ<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>
            <Link to="/bai-viet" className={cx(btn, 'border border-white/60 text-white hover:border-white hover:bg-white/10')}><BookOpen aria-hidden className="size-5" />Đọc phả ký</Link>
          </div>
        </div>
      </section>

      {hasForeword && (
        <Container size="text" className="pt-16 sm:pt-20">
          <section aria-labelledby="h-foreword">
            <div className="text-center">
              <Ornament className="text-accent" />
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Lời nói đầu</p>
              <h2 id="h-foreword" className="mt-2 font-serif text-3xl font-medium text-ink sm:text-5xl">{site.site_name}</h2>
            </div>
            {site.intro_image_file_id && <img src={fileUrl(site.intro_image_file_id)} alt="" loading="lazy" className="gp-frame-ink mt-10 aspect-[16/9] w-full object-cover" />}
            <RichContent html={site.foreword} className="mt-8" />
          </section>
        </Container>
      )}

      {/* Sự kiện theo trục thời gian: trục ở giữa trên màn rộng, các mốc so le trái phải */}
      <Container className="pt-16 sm:pt-20">
        <section aria-labelledby="h-events">
          <div className="text-center">
            <Ornament className="text-accent" />
            <h2 id="h-events" className="mt-5 font-serif text-3xl font-medium text-ink sm:text-5xl">Sắp tới</h2>
          </div>
          {loadingEvents ? <Skeleton className="mt-10 h-48" /> : !events.length ? <div className="mt-8 text-center">{noEvents}</div> : (
            <ol className="relative mx-auto mt-10 max-w-5xl">
              <span aria-hidden className="absolute bottom-0 left-2 top-0 w-px bg-line-strong lg:left-1/2" />
              {events.slice(0, 6).map((e, k) => {
                const t = when(e);
                return (
                  <li key={e.id} className="relative pb-6 pl-10 last:pb-0 lg:grid lg:grid-cols-2 lg:gap-x-20 lg:pl-0">
                    <span aria-hidden className="absolute left-2 top-7 size-3 -translate-x-1/2 rotate-45 bg-accent lg:left-1/2" />
                    <div className={cx('border border-line bg-surface p-5', k % 2 ? 'lg:col-start-2' : 'lg:text-right')}>
                      <p className="font-serif text-3xl font-medium leading-none text-accent">{t.d} <span className="text-lg text-ink-2">tháng {t.m}</span></p>
                      <p className="mt-3 font-serif text-xl font-medium text-ink">{e.member_id ? <Link to={`/thanh-vien/${e.member_id}`} className="underline-offset-4 hover:underline">{e.title}</Link> : e.title}</p>
                      <p className="mt-1 text-sm text-ink-2">{weekday(e.next_date)}, {t.d}/{t.m}/{t.y}. Tức {t.lunar.day}/{t.lunar.month} âm lịch</p>
                      {e.location && <p className={cx('mt-1.5 flex items-start gap-1.5 text-sm text-ink-2', !(k % 2) && 'lg:justify-end')}><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" /><span>{e.location}</span></p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <LockNote site={site} className="text-center" />
          <p className="mt-8 text-center">
            <Link to="/su-kien" className={cx(btn, 'h-11 px-5 border border-accent text-accent hover:bg-accent hover:text-white')}><CalendarDays aria-hidden className="size-[18px]" />Xem lịch giỗ<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>
          </p>
        </section>
      </Container>

      <Container className="pt-16 sm:pt-20">
        <section aria-labelledby="h-articles">
          <SectionHead id="h-articles" title="Phả ký" to="/bai-viet" more="Xem tất cả" />
          {loadingArticles ? <Skeleton className="h-64" /> : !slides.length && !rest.length ? noPosts : (
            <>
              {slides.length > 0 && <Featured items={slides} />}
              {rest.length > 0 && <ul className={cx('grid gap-4 lg:grid-cols-2', slides.length > 0 && 'mt-6')}>{rest.slice(0, 4).map((a) => <li key={a.id}><PostRow a={a} card /></li>)}</ul>}
            </>
          )}
        </section>
      </Container>

      {/* Lối tắt: bốn ô vuông viền kép */}
      <Container className="pt-16 sm:pt-20">
        <nav aria-label="Khám phá gia phả" className="grid grid-cols-2 gap-5 p-1.5 lg:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="gp-frame-ink group flex flex-col items-center gap-3 bg-surface px-4 py-8 text-center transition-colors hover:bg-accent hover:text-white">
              <q.icon aria-hidden className="size-8 text-accent transition-colors group-hover:text-white" strokeWidth={1.4} />
              <span className="font-serif text-xl font-medium text-ink transition-colors group-hover:text-white">{q.label}</span>
              <span className="text-sm text-ink-2 transition-colors group-hover:text-white">{q.sub}</span>
            </Link>
          ))}
        </nav>
      </Container>

      <Container className="pb-4 pt-16 sm:pt-20"><MapBlock site={site} /></Container>
    </>
  );
}

/* ===================== Ngói rêu: menu dọc, một cột ===================== */
export function Sidebar({ site, slides, rest, events, hasForeword, loadingArticles, loadingEvents }: HomeData) {
  const banner = bannerOf(site);
  const wrap = 'mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-10';
  return (
    <div className={wrap}>
      <header className="pt-10 sm:pt-14">
        {site.site_tagline && <p className="font-serif text-lg italic text-gold">{site.site_tagline}</p>}
        <h1 className="mt-2 font-serif text-4xl font-medium leading-[1.1] text-balance text-ink sm:text-5xl xl:text-6xl">{site.site_name}</h1>
        {site.intro && <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-ink-2 sm:text-lg">{site.intro}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/pha-do" className={cx(btn, 'h-11 px-5 bg-accent text-white hover:bg-accent-hover')}><Network aria-hidden className="size-5" />Xem phả đồ<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>
          <Link to="/bai-viet" className={cx(btn, 'h-11 px-5 border border-line-strong text-ink hover:border-ink hover:bg-surface')}><BookOpen aria-hidden className="size-5" />Đọc phả ký</Link>
        </div>
      </header>
      {banner
        ? <img src={banner} alt="" className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover sm:aspect-[21/9]" />
        : <div aria-hidden className="gp-lac mt-8 h-28 rounded-2xl" />}

      {/* Lối tắt: danh sách dòng, không dùng thẻ rời */}
      <nav aria-label="Khám phá gia phả" className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="group flex items-center gap-4 bg-surface p-4 transition-colors hover:bg-sunken">
            <q.icon aria-hidden className="size-6 shrink-0 text-accent" strokeWidth={1.6} />
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-lg font-medium text-ink">{q.label}</span>
              <span className="block text-sm text-ink-2">{q.sub}</span>
            </span>
            <ArrowRight aria-hidden className="gp-arrow size-4 text-ink-3" />
          </Link>
        ))}
      </nav>

      {hasForeword && (
        <section aria-labelledby="h-foreword" className="mt-12 border-l-4 border-accent pl-5 sm:pl-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Lời nói đầu</p>
          <h2 id="h-foreword" className="mt-1 font-serif text-3xl font-medium text-ink">{site.site_name}</h2>
          <RichContent html={site.foreword} className="mt-4 max-w-prose" />
        </section>
      )}

      {slides.length > 0 && <div className="mt-12"><Featured items={slides} /></div>}

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="h-articles">
          <SectionHead id="h-articles" title="Phả ký" to="/bai-viet" more="Xem tất cả" />
          {loadingArticles ? <Skeleton className="h-64" /> : !rest.length ? (slides.length ? <p className="text-ink-2">Các bài viết khác sẽ hiện ở đây.</p> : noPosts)
            : <ul className="divide-y divide-line border-y border-line">{rest.slice(0, 6).map((a) => <li key={a.id}><PostRow a={a} /></li>)}</ul>}
        </section>
        {/* Lịch bám theo khi cuộn trên màn rộng */}
        <section aria-labelledby="h-events" className="lg:sticky lg:top-6 lg:self-start">
          <SectionHead id="h-events" title="Sắp tới" to="/su-kien" more="Lịch" />
          {loadingEvents ? <Skeleton className="h-48" /> : !events.length ? noEvents
            : <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{events.slice(0, 5).map((e) => <EventRow key={e.id} e={e} compact />)}</ul>}
          <LockNote site={site} />
        </section>
      </div>

      <MapBlock site={site} className="mt-12" />
    </div>
  );
}

/* ===================== Mực tàu: cuộn thư ===================== */
export function Scroll({ site, slides, rest, events, hasForeword, loadingArticles, loadingEvents }: HomeData) {
  const banner = bannerOf(site);
  const posts = [...slides, ...rest].slice(0, 7);
  const h2 = 'gp-rule font-serif text-2xl font-medium text-ink sm:text-3xl';
  const more = 'inline-flex min-h-11 items-center gap-1.5 font-serif text-lg text-ink underline decoration-line-strong underline-offset-8 hover:decoration-ink';
  return (
    <Container size="text" className="pt-12 sm:pt-20">
      <header className="text-center">
        {/* Dấu triện: chữ đầu của tên họ */}
        <span aria-hidden className="mx-auto flex size-16 items-center justify-center bg-gold font-serif text-4xl font-semibold text-white">{initial(site)}</span>
        {site.site_tagline && <p className="mt-6 text-sm font-medium uppercase tracking-[0.25em] text-ink-2">{site.site_tagline}</p>}
        <h1 className="mt-4 font-serif text-5xl font-medium leading-[1.05] tracking-tight text-balance text-ink sm:text-7xl">{site.site_name}</h1>
        <hr className="mx-auto mt-8 w-16 border-0 border-t-2 border-ink" />
        {site.intro && <p className="mx-auto mt-8 max-w-xl whitespace-pre-line font-serif text-lg italic leading-relaxed text-ink-2 sm:text-xl">{site.intro}</p>}
        <nav aria-label="Khám phá gia phả" className="mt-6 flex flex-wrap justify-center gap-x-7">
          {QUICK.map((q) => <Link key={q.to} to={q.to} className={more}>{q.label}</Link>)}
        </nav>
      </header>
      {banner && <div className="mt-12 border border-ink p-1.5"><img src={banner} alt="" className="aspect-[16/9] w-full object-cover" /></div>}

      {hasForeword && (
        <section aria-labelledby="h-foreword" className="mt-16">
          <h2 id="h-foreword" className={h2}>Lời nói đầu</h2>
          <RichContent html={site.foreword} className="mt-8" />
        </section>
      )}

      <section aria-labelledby="h-articles" className="mt-16">
        <h2 id="h-articles" className={h2}>Phả ký</h2>
        {loadingArticles ? <Skeleton className="mt-8 h-48" /> : !posts.length ? <div className="mt-8 text-center">{noPosts}</div> : (
          <ul className="mt-6 divide-y divide-line">
            {posts.map((a) => (
              <li key={a.id} className="grid gap-x-6 gap-y-1 py-5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                <span className="pt-1 text-sm tabular-nums text-ink-3">{postDate(a.created_at)}</span>
                <span className="min-w-0">
                  <Link to={`/bai-viet/${a.slug}`} className="font-serif text-xl font-medium leading-snug text-ink underline-offset-4 hover:underline sm:text-2xl">{a.title}</Link>
                  {a.summary && <span className="mt-1.5 block text-ink-2 line-clamp-2">{a.summary}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-center"><Link to="/bai-viet" className={more}>Tất cả bài viết<ArrowRight aria-hidden className="gp-arrow size-4" /></Link></p>
      </section>

      <section aria-labelledby="h-events" className="mt-16">
        <h2 id="h-events" className={h2}>Sắp tới</h2>
        {loadingEvents ? <Skeleton className="mt-8 h-48" /> : !events.length ? <div className="mt-8 text-center">{noEvents}</div> : (
          <ul className="mt-6 divide-y divide-line">
            {events.slice(0, 6).map((e) => {
              const t = when(e);
              return (
                <li key={e.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-x-6">
                  <span className="font-serif text-3xl font-medium leading-none tabular-nums text-ink">{t.d}<span className="text-gold">.</span>{t.m}</span>
                  <span className="min-w-0">
                    <span className="block font-serif text-xl font-medium text-ink">{e.member_id ? <Link to={`/thanh-vien/${e.member_id}`} className="underline-offset-4 hover:underline">{e.title}</Link> : e.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{weekday(e.next_date)}, {t.d}/{t.m}/{t.y}. Tức {t.lunar.day}/{t.lunar.month} âm lịch</span>
                    {e.location && <span className="mt-0.5 block text-sm text-ink-2">{e.location}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <LockNote site={site} className="text-center" />
        <p className="mt-4 text-center"><Link to="/su-kien" className={more}>Lịch giỗ và sự kiện<ArrowRight aria-hidden className="gp-arrow size-4" /></Link></p>
      </section>

      <MapBlock site={site} className="mt-16" />
    </Container>
  );
}
