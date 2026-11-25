import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import type { Site } from '../lib/types.ts';
import { cx, Loading, ErrorState } from '../components/ui.tsx';

const SiteCtx = createContext<{ site: Site; reload: () => void } | null>(null);
export const useSite = () => useContext(SiteCtx)!;

const NAV = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/pha-do', label: 'Phả đồ' },
  { to: '/bai-viet', label: 'Phả ký' },
  { to: '/su-kien', label: 'Sự kiện' },
  { to: '/album', label: 'Thư viện' },
];

export function SiteLayout() {
  const { data: site, error, reload } = useApi<Site>('/site');
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  useEffect(() => {
    if (site) document.title = site.site_name;
  }, [site]);

  if (error) return <div className="max-w-xl mx-auto p-6"><ErrorState error={error} onRetry={reload} /></div>;
  if (!site) return <Loading />;

  return (
    <SiteCtx.Provider value={{ site, reload }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 bg-surface p-2 z-50">Bỏ qua menu</a>
      <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur border-b border-line no-print pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4 lg:gap-6">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            {site.logo_file_id ? (
              <img src={fileUrl(site.logo_file_id)} alt="" className="size-9 rounded-full object-cover" />
            ) : (
              <span className="size-9 rounded-full bg-accent text-white inline-flex items-center justify-center font-serif font-semibold">
                {site.site_name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || 'G'}
              </span>
            )}
            <span className="font-serif font-semibold text-lg text-ink truncate">{site.site_name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-auto" aria-label="Chính">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx('px-3 h-10 inline-flex items-center rounded-lg text-[15px] font-medium',
                  isActive ? 'text-accent bg-accent-soft' : 'text-ink-2 hover:text-ink hover:bg-sunken', 'max-lg:px-2.5')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className="md:hidden ml-auto size-10 inline-flex items-center justify-center rounded-lg hover:bg-sunken cursor-pointer"
            aria-label="Mở menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
        {menu && (
          <nav className="md:hidden border-t border-line bg-surface px-4 py-2" aria-label="Chính (di động)">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx('flex h-12 items-center px-3 rounded-lg font-medium', isActive ? 'text-accent bg-accent-soft' : 'text-ink')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="min-h-[calc(100vh-4rem-180px)]">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface mt-16 no-print">
        <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-serif font-semibold text-ink text-base">{site.site_name}</p>
            <p className="mt-2 text-ink-2 leading-relaxed">{site.site_tagline}</p>
          </div>
          <div>
            <p className="font-medium text-ink">Chuyên mục</p>
            <ul className="mt-1">
              {site.categories.map((c) => (
                <li key={c.id}><Link className="inline-flex items-center min-h-9 pointer-coarse:min-h-11 text-ink-2 hover:text-accent" to={`/bai-viet?c=${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Liên hệ</p>
            <p className="mt-2 text-ink-2 whitespace-pre-line leading-relaxed">{site.contact || site.address || 'Ban liên lạc dòng họ'}</p>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="max-w-6xl xl:max-w-[90rem] 2xl:max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 min-h-12 pb-[env(safe-area-inset-bottom)] flex items-center justify-between gap-4 text-sm text-ink-3">
            <span>© {new Date().getFullYear()} {site.site_name}</span>
            <Link to="/chinh-sach-bao-mat" className="inline-flex items-center min-h-10 px-2 ml-auto hover:text-ink">Chính sách bảo mật</Link>
            <Link to="/admin" className="inline-flex items-center min-h-10 px-2 -mr-2 hover:text-ink">Quản trị</Link>
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
