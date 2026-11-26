import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { Site } from '../lib/types.ts';
import { ArrowLeft, ArrowUpRight, ChevronRight, Eye, Mail, MapPin, Menu as MenuIcon, Music2, Phone, Play, X } from 'lucide-react';
import { cx, Loading, ErrorState } from '../components/ui.tsx';
import { TEMPLATES, templateOf, type TemplateId } from '../../shared/site.ts';

const SiteCtx = createContext<{ site: Site; reload: () => void; template: TemplateId } | null>(null);
export const useSite = () => useContext(SiteCtx)!;

import { defaultMenu, menuLinks, type MenuLink } from '../../shared/menu.ts';

/** Một mục menu. Chuyên mục dùng chung đường dẫn /bai-viet nên phải so cả tham số ?c= mới biết mục nào đang mở. */
function MenuEntry({ n, mobile }: { n: MenuLink; mobile?: boolean }) {
  const loc = useLocation();
  const [path, query = ''] = n.to.split('?');
  const want = new URLSearchParams(query).get('c');
  const have = new URLSearchParams(loc.search).get('c');
  const onPath = path === '/' ? loc.pathname === '/' : loc.pathname === path || loc.pathname.startsWith(path + '/');
  const active = !n.external && onPath && (loc.pathname === path ? (want ?? '') === (path === '/bai-viet' ? have ?? '' : want ?? '') : !want);
  const cls = mobile
    ? cx('flex h-12 items-center gap-1.5 px-3 rounded-lg font-serif text-lg font-medium transition-colors', active ? 'text-accent bg-accent-soft' : 'text-ink hover:bg-sunken')
    : cx('gp-nav relative px-3 h-10 inline-flex items-center gap-1 rounded-lg font-serif text-[17px] font-medium max-lg:px-2.5 max-lg:text-base whitespace-nowrap transition-colors', active ? 'text-accent is-active' : 'text-ink-2 hover:text-ink');
  if (n.external) return <a href={n.to} target="_blank" rel="noopener noreferrer" className={cls}>{n.label}<ArrowUpRight aria-hidden className="size-3.5" /><span className="sr-only"> (mở trang khác)</span></a>;
  return <Link to={n.to} aria-current={active ? 'page' : undefined} className={cls}>{n.label}</Link>;
}

export function SiteLayout() {
  const { data: site, error, reload } = useApi<Site>('/site');
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname, loc.search]);
  // Liên kết dạng /#ten-khoi: cuộn tới khối đó. Thử lại vài lần vì nội dung trang tải sau.
  useEffect(() => {
    if (!loc.hash) return;
    const id = decodeURIComponent(loc.hash.slice(1));
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); el.focus?.({ preventScroll: true }); }
      if (el || ++tries > 20) clearInterval(t);
    }, 150);
    return () => clearInterval(t);
  }, [loc.hash, loc.pathname, loc.key]);
  useEffect(() => {
    if (!site) return;
    document.title = site.site_name;
    // Favicon do quản trị tải lên thay cho biểu tượng mặc định
    if (site.favicon_file_id) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = fileUrl(site.favicon_file_id);
    }
  }, [site]);

  // Xem thử mẫu từ trang quản trị: /?mau=<id>. Giữ trong phiên của tab này, không ảnh hưởng người khác.
  const [preview, setPreview] = useState<string | null>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('mau');
      if (q) sessionStorage.setItem('gp-mau', q);
      return sessionStorage.getItem('gp-mau');
    } catch { return null; }
  });
  const stopPreview = () => { try { sessionStorage.removeItem('gp-mau'); } catch { /* bỏ qua */ } setPreview(null); };

  // Mẫu trang đổi bảng màu và độ bo góc của cả trang xem qua thuộc tính data-tpl trên <html> (xem index.css)
  const tpl = site ? templateOf(preview && TEMPLATES.some((t) => t.id === preview) ? preview : site.template) : null;
  useEffect(() => {
    if (!tpl) return;
    document.documentElement.dataset.tpl = tpl;
    return () => { delete document.documentElement.dataset.tpl; };
  }, [tpl]);

  if (error) return <div className="max-w-xl mx-auto p-6"><ErrorState error={error} onRetry={reload} /></div>;
  if (!site) return <Loading />;
  const template = templateOf(preview && TEMPLATES.some((t) => t.id === preview) ? preview : site.template);
  const previewing = !!preview && template !== templateOf(site.template);
  const logo = site.logo_file_id ? (
    <img src={fileUrl(site.logo_file_id)} alt="" className="size-9 rounded-full object-cover" />
  ) : (
    <span className="size-9 shrink-0 rounded-full bg-accent text-white inline-flex items-center justify-center font-serif font-semibold">
      {site.site_name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || 'G'}
    </span>
  );
  const NAV = site.menu?.length ? site.menu : menuLinks(defaultMenu(), new Set());
  // Mạng xã hội khai ở Cấu hình website > Liên hệ và bản đồ. Nút có chữ kèm biểu tượng để người lớn tuổi dễ nhận ra.
  // Zalo, Facebook dùng file biểu tượng do chủ trang cung cấp (public/social), mỗi mẫu trang một bản theo màu nhấn của mẫu.
  const socials = [
    { label: 'Zalo', href: site.contact_zalo, img: `/social/zalo-${template}.svg` },
    { label: 'Facebook', href: site.contact_facebook, img: `/social/facebook-${template}.svg` },
    { label: 'YouTube', href: site.contact_youtube, icon: Play },
    { label: 'TikTok', href: site.contact_tiktok, icon: Music2 },
  ].filter((x) => !!x.href) as { label: string; href: string; img?: string; icon?: typeof Play }[];
  const flink = 'inline-flex items-center gap-1 min-h-9 pointer-coarse:min-h-11 text-ink-2 hover:text-accent hover:underline underline-offset-4';

  return (
    <SiteCtx.Provider value={{ site, reload, template }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 bg-surface p-2 z-50">Bỏ qua menu</a>
      {previewing && (
        <div role="status" className="no-print bg-ink text-white text-sm">
          <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 min-h-11 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Eye aria-hidden className="size-4 shrink-0" />
            <span className="flex-1 min-w-0">Đang xem thử mẫu <b className="font-semibold">{TEMPLATES.find((t) => t.id === template)?.name}</b>. Người khác vẫn thấy mẫu cũ.</span>
            <button onClick={stopPreview} className="h-8 px-3 rounded-md bg-white/15 hover:bg-white/25 font-medium cursor-pointer transition-colors">Thoát xem thử</button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur border-b border-line no-print pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4 lg:gap-6">
          <Link to="/" className="group flex items-center gap-3 min-w-0">
            {logo}
            <span className="font-serif font-semibold text-lg text-ink truncate">{site.site_name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-auto" aria-label="Chính">
            {NAV.map((n) => <MenuEntry key={n.to + n.label} n={n} />)}
          </nav>
          <button className="md:hidden ml-auto size-10 inline-flex items-center justify-center rounded-lg hover:bg-sunken cursor-pointer transition-colors"
            aria-label={menu ? 'Đóng menu' : 'Mở menu'} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            {menu ? <X aria-hidden className="size-6" /> : <MenuIcon aria-hidden className="size-6" />}
          </button>
        </div>
        {menu && (
          <nav className="gp-rise md:hidden border-t border-line bg-surface px-4 py-2" aria-label="Chính (di động)">
            {NAV.map((n) => <MenuEntry key={n.to + n.label} n={n} mobile />)}
          </nav>
        )}
      </header>
      <main id="main" className="min-h-[calc(100vh-4rem-180px)]">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface mt-16 no-print pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="max-w-md">
            <Link to="/" className="inline-flex items-center gap-3 min-w-0">
              {logo}
              <span className="font-serif font-semibold text-xl text-ink">{site.site_name}</span>
            </Link>
            {(site.site_tagline || site.intro) && <p className="mt-4 text-ink-2 leading-relaxed">{site.intro || site.site_tagline}</p>}
            {socials.length > 0 && (
              <ul className="mt-3 -ml-1 flex flex-wrap gap-1" aria-label="Mạng xã hội">
                {socials.map((x) => (
                  <li key={x.label}>
                    {/* Chỉ có biểu tượng: tên mạng nằm trong aria-label và title */}
                    <a href={x.href} target="_blank" rel="noopener noreferrer" aria-label={`${x.label} (mở trang khác)`} title={x.label}
                      className="size-9 pointer-coarse:size-11 inline-flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 motion-reduce:transform-none">
                      {x.img
                        ? <img src={x.img} alt="" width={28} height={28} className="size-7" />
                        : <span className="size-7 inline-flex items-center justify-center rounded-full bg-accent text-white">{x.icon && <x.icon aria-hidden className="size-3.5" />}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-8 grid-cols-2 sm:grid-cols-[1fr_1fr_minmax(0,1.5fr)]">
            <nav aria-labelledby="f-explore">
              <h2 id="f-explore" className="text-sm font-semibold uppercase tracking-wider text-ink">Khám phá</h2>
              <ul className="mt-2">
                <li><Link to="/" className={flink}>Tổng quan gia tộc</Link></li>
                <li><Link to="/pha-do" className={flink}>Phả đồ</Link></li>
                {/* Khối Nhà thờ họ nằm cuối trang chủ, chỉ có khi đã khai địa chỉ hoặc bản đồ; chưa có thì dẫn về trang Liên hệ */}
                <li><Link to={site.address || site.map_embed ? '/#nha-tho-ho' : '/lien-he'} className={flink}>Nhà thờ họ</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="f-docs">
              <h2 id="f-docs" className="text-sm font-semibold uppercase tracking-wider text-ink">Tư liệu họ tộc</h2>
              <ul className="mt-2">
                <li><Link to="/su-kien" className={flink}>Sự kiện</Link></li>
                <li><Link to="/bai-viet" className={flink}>Phả ký</Link></li>
                <li><Link to="/album" className={flink}>Album</Link></li>
              </ul>
            </nav>
            <div className="col-span-2 sm:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">Liên hệ</h2>
              <ul className="mt-3 space-y-2.5 text-ink-2">
                {site.address && <li className="flex gap-2"><MapPin aria-hidden className="size-4 shrink-0 mt-1" /><span>{site.address}</span></li>}
                {site.contact_phone && <li className="flex gap-2"><Phone aria-hidden className="size-4 shrink-0 mt-1" /><a href={`tel:${site.contact_phone.replace(/[^\d+]/g, '')}`} className="hover:text-accent hover:underline underline-offset-4">{site.contact_phone}</a></li>}
                {site.contact_email && <li className="flex gap-2"><Mail aria-hidden className="size-4 shrink-0 mt-1" /><a href={`mailto:${site.contact_email}`} className="[overflow-wrap:anywhere] hover:text-accent hover:underline underline-offset-4">{site.contact_email}</a></li>}
              </ul>
              <Link to="/lien-he" className={cx(flink, 'mt-1 font-semibold !text-accent')}>{site.contact_form === '0' ? 'Trang Liên hệ' : 'Gửi lời nhắn'}<ChevronRight aria-hidden className="size-4" /></Link>
            </div>
          </div>
        </div>
        <div className="border-t border-line bg-sunken/60">
          <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 min-h-12 py-1 flex flex-wrap items-center gap-x-4 text-sm text-ink-2">
            <span className="w-full sm:w-auto sm:mr-auto pt-3 sm:pt-0">© {new Date().getFullYear()} {site.site_name}</span>
            <Link to="/chinh-sach-bao-mat" className="inline-flex items-center min-h-10 hover:text-ink hover:underline underline-offset-4">Chính sách bảo mật</Link>
            <Link to="/admin" className="inline-flex items-center min-h-10 hover:text-ink hover:underline underline-offset-4">Quản trị</Link>
          </div>
        </div>
      </footer>
    </SiteCtx.Provider>
  );
}

const SIZES = {
  // Đọc chữ: giữ dòng 65-80 ký tự
  text: 'max-w-3xl',
  narrow: 'max-w-xl',
  // Mặc định: lớn dần theo màn hình
  default: 'max-w-6xl 2xl:max-w-7xl',
  // Header, footer và màn dữ liệu dùng chung khổ để thẳng hàng
  // Màn dữ liệu / canvas: tận dụng màn lớn
  wide: 'max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem]',
};
export function Container({ children, className, size = 'default' }: {
  children: React.ReactNode; className?: string; size?: keyof typeof SIZES;
}) {
  return <div className={cx('w-full mx-auto px-4 sm:px-6 lg:px-8', SIZES[size], className)}>{children}</div>;
}

/** Nút quay lại kèm đường dẫn cho các trang chi tiết. Nếu người xem vừa đi từ một trang khác trong site
    thì nút quay về đúng trang đó (giữ vị trí cuộn, bộ lọc); mở thẳng từ link ngoài thì về trang cấp trên. */
export function Crumbs({ items, current }: { items: { to: string; label: string }[]; current: string }) {
  const nav = useNavigate();
  const parent = items[items.length - 1];
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav(parent.to));
  return (
    <nav aria-label="Đường dẫn" className="flex items-center gap-2.5 mb-6 min-w-0 no-print">
      <button type="button" onClick={back} aria-label="Quay lại" title="Quay lại"
        className="size-10 pointer-coarse:size-11 shrink-0 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-ink cursor-pointer transition-colors hover:bg-sunken hover:border-ink">
        <ArrowLeft aria-hidden className="size-[18px]" />
      </button>
      <ol className="flex items-center gap-1.5 min-w-0 text-sm text-ink-2">
        {items.map((c) => (
          <li key={c.to} className="flex items-center gap-1.5 shrink-0">
            <Link to={c.to} className="inline-flex items-center min-h-10 hover:text-ink hover:underline underline-offset-4">{c.label}</Link>
            <ChevronRight aria-hidden className="size-3.5" />
          </li>
        ))}
        <li aria-current="page" className="font-medium text-ink truncate">{current}</li>
      </ol>
    </nav>
  );
}
