import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mapEmbedUrl } from '../../shared/map.ts';
import { fileUrl } from '../lib/api.ts';
import type { ArticleBrief, Site, UpcomingEvent } from '../lib/types.ts';
import { ArrowRight, BookOpen, CalendarDays, Images, MapPin, Network, Pause, Play } from 'lucide-react';
import { cx } from '../components/ui.tsx';

// Các khối dùng chung cho mọi bố cục trang chủ (Home.tsx là bố cục gốc, HomeLayouts.tsx là bốn bố cục bổ sung).
export const btn = 'group h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[.98]';

export const QUICK = [
  { to: '/pha-do', icon: Network, label: 'Phả đồ', sub: 'Cây phả hệ các đời' },
  { to: '/bai-viet', icon: BookOpen, label: 'Phả ký', sub: 'Lịch sử, bài viết' },
  { to: '/su-kien', icon: CalendarDays, label: 'Sự kiện', sub: 'Lễ tế, ngày giỗ' },
  { to: '/album', icon: Images, label: 'Thư viện', sub: 'Ảnh tư liệu' },
];

/** Dữ liệu trang chủ, tải một lần ở Home rồi đưa cho bố cục của mẫu đang dùng. */
export type HomeData = {
  site: Site;
  loadingArticles: boolean;
  loadingEvents: boolean;
  /** Bài nổi bật (tối đa 5) */
  slides: ArticleBrief[];
  /** Các bài còn lại, mới nhất trước */
  rest: ArticleBrief[];
  events: UpcomingEvent[];
  hasForeword: boolean;
};

/** Khối Nhà thờ họ: địa chỉ và bản đồ. Liên kết /#nha-tho-ho ở chân trang cuộn tới đây. */
export function MapBlock({ site, className }: { site: Site; className?: string }) {
  if (!site.address && !site.map_embed) return null;
  return (
    <section id="nha-tho-ho" tabIndex={-1} aria-labelledby="h-map" className={cx('scroll-mt-24 rounded-xl border border-line bg-surface overflow-hidden outline-none', className)}>
      <div className="p-5">
        <h2 id="h-map" className="font-serif text-2xl font-medium">Nhà thờ họ</h2>
        {site.address && <p className="mt-1 inline-flex items-start gap-1.5 text-ink-2"><MapPin aria-hidden className="size-4 mt-1 shrink-0" />{site.address}</p>}
      </div>
      {site.map_embed && (
        <iframe title="Bản đồ nhà thờ họ" className="w-full h-80 border-0" loading="lazy"
          src={mapEmbedUrl(site.map_embed, site.address) ?? undefined} />
      )}
    </section>
  );
}

/** Ngày đăng dạng dd/mm/yyyy */
export const postDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Tiêu đề khối: chữ serif lớn bên trái, liên kết "xem tất cả" màu son bên phải. */
export function SectionHead({ id, title, to, more }: { id: string; title: string; to?: string; more?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <h2 id={id} className="font-serif text-[1.75rem] sm:text-4xl font-medium text-ink leading-tight">{title}</h2>
      {to && <Link to={to} className="group inline-flex items-center gap-1.5 min-h-10 shrink-0 font-semibold text-accent hover:text-accent-hover">{more}<ArrowRight aria-hidden className="gp-arrow size-4" /></Link>}
    </div>
  );
}

/** Thẻ bài viết nổi bật. Nhiều bài thì tự chuyển sau mỗi 6 giây; chấm chọn bài và nút tạm dừng nằm ngoài thẻ, ngay bên dưới.
    Tự dừng khi rê chuột, khi đang focus bên trong, khi tab bị ẩn, và không tự chạy nếu người dùng chọn giảm chuyển động. */
export function Featured({ items }: { items: ArticleBrief[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hold, setHold] = useState(false);
  const touch = useRef<number | null>(null);
  const n = items.length;
  const cur = items[Math.min(i, n - 1)];
  useEffect(() => {
    if (n < 2 || paused || hold) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') setI((x) => (x + 1) % n); }, 6000);
    return () => clearInterval(t);
  }, [n, paused, hold]);
  const go = (k: number) => setI(((k % n) + n) % n);
  return (
    <section aria-roledescription="carousel" aria-label="Bài viết nổi bật"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - (touch.current ?? 0); if (n > 1 && Math.abs(d) > 48) go(i + (d < 0 ? 1 : -1)); touch.current = null; }}
>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-28px_rgb(33_28_24/0.55)]">
      <Link key={cur.id} to={`/bai-viet/${cur.slug}`} aria-labelledby="h-featured"
        aria-roledescription="slide" aria-label={n > 1 ? `Bài ${i + 1} trên ${n}` : undefined}
        // Chiều cao thẻ cố định từ md trở lên; ảnh luôn cao bằng thẻ. Trước đây chỉ khung ảnh có chiều cao cố định,
        // nên bài có tiêu đề dài làm cột chữ cao hơn ảnh và lộ một dải trống dưới ảnh.
        className="gp-fade group grid md:h-[27rem] md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* Bài không có ảnh bìa vẫn giữ ô ảnh (nền giấy dó, biểu tượng sách) để mọi thẻ cao bằng nhau */}
        <span className="flex items-center justify-center overflow-hidden aspect-[16/10] md:aspect-auto md:h-full min-h-0 bg-do">
          {cur.cover_file_id
            ? <img src={fileUrl(cur.cover_file_id)} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none" />
            : <BookOpen aria-hidden className="size-20 text-line-strong" strokeWidth={1} />}
        </span>
        <span className="flex flex-col justify-center min-h-0 overflow-hidden p-6 sm:p-10 lg:p-12 max-md:h-80">
          <span className="text-sm font-semibold uppercase tracking-wider text-accent">Bài viết nổi bật</span>
          <span id="h-featured" className="mt-3 font-serif text-3xl sm:text-4xl font-medium leading-tight text-ink text-balance line-clamp-2 md:line-clamp-3">{cur.title}</span>
          {cur.category_name && <span className="mt-3 text-sm text-ink-3 truncate">{cur.category_name}</span>}
          {cur.summary && <span className="mt-4 font-serif italic text-lg text-ink-2 line-clamp-2">{cur.summary}</span>}
          <span className="mt-6 inline-flex items-center gap-2 font-semibold text-accent">Đọc tiếp<ArrowRight aria-hidden className="gp-arrow size-4" /></span>
        </span>
      </Link>
      </div>
      {n > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1">
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

