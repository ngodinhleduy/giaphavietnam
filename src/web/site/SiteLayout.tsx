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
      <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur border-b border-line no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
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
                  isActive ? 'text-accent bg-accent-soft' : 'text-ink-2 hover:text-ink hover:bg-sunken')}>
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
                className={({ isActive }) => cx('flex h-12 items-center px-2 rounded-lg font-medium', isActive ? 'text-accent' : 'text-ink')}>
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-serif font-semibold text-ink text-base">{site.site_name}</p>
            <p className="mt-2 text-ink-2 leading-relaxed">{site.site_tagline}</p>
          </div>
          <div>
            <p className="font-medium text-ink">Chuyên mục</p>
            <ul className="mt-2 space-y-1.5">
              {site.categories.map((c) => (
                <li key={c.id}><Link className="text-ink-2 hover:text-accent" to={`/bai-viet?c=${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Liên hệ</p>
            <p className="mt-2 text-ink-2 whitespace-pre-line leading-relaxed">{site.contact || site.address || 'Ban liên lạc dòng họ'}</p>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-sm text-ink-3">
            <span>© {new Date().getFullYear()} {site.site_name}</span>
            <Link to="/admin" className="hover:text-ink">Quản trị</Link>
          </div>
        </div>
      </footer>
    </SiteCtx.Provider>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('w-full max-w-6xl mx-auto px-4 sm:px-6', className)}>{children}</div>;
}
