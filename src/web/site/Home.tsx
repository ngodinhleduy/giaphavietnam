import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { ArticleBrief, UpcomingEvent } from '../lib/types.ts';
import { ArrowRight, BookOpen, CalendarDays, FileText, Images, MapPin, Network, Pause, Play } from 'lucide-react';
import type { Site } from '../lib/types.ts';
import type { TemplateId } from '../../shared/site.ts';
import { Container, useSite } from './SiteLayout.tsx';
import { EmptyState, Skeleton, cx } from '../components/ui.tsx';
import { EventRow } from './Events.tsx';
import { RichContent } from '../components/RichContent.tsx';

const btn = 'group h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[.98]';

/** Phần đầu trang chủ. Mỗi mẫu một cách trình bày, nội dung như nhau. */
function Hero({ site, template, lift }: { site: Site; template: TemplateId; lift: boolean }) {
  const banner = template !== 'toi-gian' && site.banner_file_id ? fileUrl(site.banner_file_id) : null;
  const dark = template === 'trong-dong' || template === 'son';
  // Có ảnh banner: chữ dồn về bên trái, phía dưới, để phần lớn ảnh không bị che. Không có ảnh: chữ canh giữa trên họa tiết.
  const photo = dark && !!banner;
  const centered = dark && !photo;
  const soft = dark ? (template === 'son' && !photo ? 'text-son-2' : 'text-cham-2') : 'text-ink-2';
  const redOnRed = template === 'son' && !photo;
  const actions = (
    <div className={cx('mt-8 flex flex-wrap gap-3', centered && 'justify-center')}>
      <Link to="/pha-do" className={cx(btn, redOnRed ? 'bg-white text-ink hover:bg-do hover:shadow-lg' : 'bg-accent text-white hover:bg-accent-hover hover:shadow-lg')}>
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

/** Tiêu đề khối: chữ serif lớn bên trái, liên kết "xem tất cả" màu son bên phải. */
function SectionHead({ id, title, to, more }: { id: string; title: string; to?: string; more?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <h2 id={id} className="font-serif text-[1.75rem] sm:text-4xl font-medium text-ink leading-tight">{title}</h2>
      {to && <Link to={to} className="group inline-flex items-center gap-1.5 min-h-10 shrink-0 font-semibold text-accent hover:text-accent-hover">{more}<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>}
    </div>
  );
}

/** Thẻ bài viết nổi bật. Nhiều bài thì tự chuyển sau mỗi 7 giây, có chấm để chọn bài và nút tạm dừng.
    Tự dừng khi rê chuột, khi đang focus bên trong, khi tab bị ẩn, và không tự chạy nếu người dùng chọn giảm chuyển động. */
function Featured({ items }: { items: ArticleBrief[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hold, setHold] = useState(false);
  const touch = useRef<number | null>(null);
  const n = items.length;
  const cur = items[Math.min(i, n - 1)];
  useEffect(() => {
    if (n < 2 || paused || hold) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') setI((x) => (x + 1) % n); }, 7000);
    return () => clearInterval(t);
  }, [n, paused, hold]);
  const go = (k: number) => setI(((k % n) + n) % n);
  return (
    <section aria-roledescription="carousel" aria-label="Bài viết nổi bật"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - (touch.current ?? 0); if (n > 1 && Math.abs(d) > 48) go(i + (d < 0 ? 1 : -1)); touch.current = null; }}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-28px_rgb(33_28_24/0.55)]">
      <Link key={cur.id} to={`/bai-viet/${cur.slug}`} aria-labelledby="h-featured"
        aria-roledescription="slide" aria-label={n > 1 ? `Bài ${i + 1} trên ${n}` : undefined}
        className={cx('gp-fade group grid', cur.cover_file_id && 'md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]')}>
        {cur.cover_file_id && (
          <span className="block overflow-hidden aspect-[16/10] md:aspect-auto md:h-96">
            <img src={fileUrl(cur.cover_file_id)} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none" />
          </span>
        )}
        <span className={cx('flex flex-col justify-center p-6 sm:p-10 lg:p-12', n > 1 && 'pb-4 sm:pb-6 lg:pb-8', !cur.cover_file_id && 'md:min-h-72')}>
          <span className="text-sm font-semibold uppercase tracking-wider text-accent">Bài viết nổi bật</span>
          <span id="h-featured" className="mt-3 font-serif text-3xl sm:text-4xl font-medium leading-tight text-ink text-balance line-clamp-3">{cur.title}</span>
          {cur.category_name && <span className="mt-3 text-sm text-ink-3">{cur.category_name}</span>}
          {cur.summary && <span className="mt-4 font-serif italic text-lg text-ink-2 line-clamp-3">{cur.summary}</span>}
          <span className="mt-6 inline-flex items-center gap-2 font-semibold text-accent">Đọc tiếp<ArrowRight aria-hidden className="gp-arrow size-4" /></span>
        </span>
      </Link>
      {n > 1 && (
        <div className="flex items-center justify-center gap-1 px-4 pb-3 pt-1 border-t border-line md:border-t-0">
          <div role="tablist" aria-label="Chọn bài nổi bật" className="flex items-center">
            {items.map((a, k) => (
              <button key={a.id} type="button" role="tab" aria-selected={k === i} aria-label={`Bài ${k + 1}: ${a.title}`} onClick={() => go(k)}
                className="group/dot h-11 px-1.5 inline-flex items-center cursor-pointer">
                <span className={cx('block h-2.5 rounded-full transition-all duration-300', k === i ? 'w-8 bg-accent' : 'w-2.5 bg-line-strong group-hover/dot:bg-ink')} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPaused((v) => !v)} aria-label={paused ? 'Tiếp tục tự chuyển bài' : 'Tạm dừng tự chuyển bài'} title={paused ? 'Tiếp tục tự chuyển bài' : 'Tạm dừng tự chuyển bài'}
            className="ml-1 size-11 inline-flex items-center justify-center rounded-full text-ink-2 cursor-pointer transition-colors hover:bg-sunken hover:text-ink">
            {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
          </button>
        </div>
      )}
    </section>
  );
}

export function Home() {
  const { site, template } = useSite();
  const articles = useApi<ArticleBrief[]>('/articles?limit=9');
  const events = useApi<UpcomingEvent[]>('/events/upcoming?days=120');
  const next = events.data?.[0];
  const QUICK = [
    { to: '/pha-do', icon: Network, label: 'Phả đồ', sub: 'Cây phả hệ các đời' },
    { to: '/bai-viet', icon: BookOpen, label: 'Phả ký', sub: 'Lịch sử, bài viết' },
    { to: '/su-kien', icon: CalendarDays, label: 'Sự kiện', sub: 'Lễ tế, ngày giỗ' },
    { to: '/album', icon: Images, label: 'Thư viện', sub: 'Ảnh tư liệu' },
  ];

  // Bài nổi bật do quản trị viên chọn (tối đa 5). Chưa chọn bài nào thì lấy bài mới nhất.
  const picked = useApi<ArticleBrief[]>('/articles/featured');
  const slides = template === 'toi-gian' || picked.loading ? [] : picked.data?.length ? picked.data : (articles.data ?? []).slice(0, 1);
  const shown = new Set(slides.map((a) => a.id));
  const rest = (articles.data ?? []).filter((a) => !shown.has(a.id)).slice(0, 4);
  const hasForeword = !!site.foreword && !!site.foreword.replace(/<[^>]*>/g, '').trim();

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
        <section className={cx('mt-12 sm:mt-16 text-[#f6efe2]', template === 'son' ? 'bg-cham' : 'gp-lac')} aria-label="Sự kiện gần nhất">
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

      {(site.address || site.map_embed) && (
        <Container className="pb-4">
          <section id="nha-tho-ho" tabIndex={-1} aria-labelledby="h-map" className="scroll-mt-24 rounded-xl border border-line bg-surface overflow-hidden outline-none">
            <div className="p-5">
              <h2 id="h-map" className="font-serif text-2xl font-medium">Nhà thờ họ</h2>
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
