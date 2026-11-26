import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { Site } from '../lib/types.ts';
import { ArrowLeft, ArrowUpRight, ChevronRight, Eye, Menu as MenuIcon, X } from 'lucide-react';
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
    ? cx('flex h-12 items-center gap-1.5 px-3 rounded-lg font-medium transition-colors', active ? 'text-accent bg-accent-soft' : 'text-ink hover:bg-sunken')
    : cx('gp-nav relative px-3 h-10 inline-flex items-center gap-1 rounded-lg text-[15px] font-medium max-lg:px-2.5 whitespace-nowrap transition-colors', active ? 'text-ink is-active' : 'text-ink-2 hover:text-ink');
  if (n.external) return <a href={n.to} target="_blank" rel="noopener noreferrer" className={cls}>{n.label}<ArrowUpRight aria-hidden className="size-3.5" /><span className="sr-only"> (mở trang khác)</span></a>;
  return <Link to={n.to} aria-current={active ? 'page' : undefined} className={cls}>{n.label}</Link>;
}

export function SiteLayout() {
  const { data: site, error, reload } = useApi<Site>('/site');
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname, loc.search]);
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
      <footer className="border-t border-line bg-bg mt-16 no-print pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:h-16 md:py-0 flex flex-col md:flex-row md:items-center gap-x-6 gap-y-2">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            {logo}
            <span className="font-serif font-semibold text-lg text-ink truncate">{site.site_name}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-1 md:ml-auto -mx-2.5 md:mx-0" aria-label="Chân trang">
            {NAV.map((n) => <MenuEntry key={n.to + n.label} n={n} />)}
          </nav>
        </div>
        <div className="border-t border-line">
          <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 min-h-12 flex flex-wrap items-center gap-x-4 text-sm text-ink-2">
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
