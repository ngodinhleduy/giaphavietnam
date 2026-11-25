import { createContext, useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays, CircleUser, Contact, ExternalLink, FileText, History, ImageUp, Images, Inbox, LayoutDashboard, LogIn, LogOut, Network, Palette,
  PanelTop, Settings, ShieldCheck, Users, type LucideIcon,
} from 'lucide-react';
import { api, fileUrl, shrinkImage } from '../lib/api.ts';
import { initials } from '../lib/format.ts';
import { Button, Field, Input, Loading, PasswordInput, Spinner, cx, useToast } from '../components/ui.tsx';

export type Me = { id: number; username: string; display_name: string; role: 'admin' | 'editor'; branch: string | null };
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);

type CountKey = 'members' | 'events' | 'articles' | 'unread' | 'pending';
// adminOnly: chỉ quản trị viên thấy. alert: số đếm là việc đang chờ xử lý, chỉ hiện khi lớn hơn 0.
type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; count?: CountKey; alert?: CountKey; adminOnly?: boolean };
const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true }] },
  { group: 'Quản lý', items: [
    { to: '/admin/tree', label: 'Phả đồ', icon: Network },
    { to: '/admin/members', label: 'Thành viên', icon: Users, count: 'members' },
    { to: '/admin/events', label: 'Sự kiện', icon: CalendarDays, count: 'events' },
    { to: '/admin/articles', label: 'Bài viết', icon: FileText, count: 'articles', alert: 'pending' },
    { to: '/admin/albums', label: 'Album ảnh', icon: Images },
  ] },
  { group: 'Website', items: [
    { to: '/admin/settings', label: 'Cấu hình', icon: Settings, adminOnly: true },
    { to: '/admin/appearance', label: 'Giao diện', icon: Palette, adminOnly: true },
    { to: '/admin/menu', label: 'Menu', icon: PanelTop, adminOnly: true },
    { to: '/admin/contact', label: 'Trang Liên hệ', icon: Contact, adminOnly: true },
    { to: '/admin/messages', label: 'Hòm thư', icon: Inbox, alert: 'unread', adminOnly: true },
  ] },
  { group: 'Hệ thống', items: [
    { to: '/admin/admins', label: 'Người quản lý', icon: ShieldCheck, adminOnly: true },
    { to: '/admin/logs', label: 'Nhật ký', icon: History, adminOnly: true },
    { to: '/admin/account', label: 'Tài khoản', icon: CircleUser },
  ] },
];
type Counts = Partial<Record<CountKey, number>>;

export function AdminLayout() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [setup, setSetup] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const [counts, setCounts] = useState<Counts>({});
  const [siteName, setSiteName] = useState('');
  const load = () =>
    api.get<Me>('/admin/me').then(setMe).catch(async () => {
      setMe(null);
      const s = await api.get<{ needsSetup: boolean }>('/admin/setup').catch(() => ({ needsSetup: false }));
      setSetup(s.needsSetup);
    });
  useEffect(() => {
    load();
    document.title = 'Quản trị gia phả';
  }, []);

  // Số đếm trên menu: tải lại mỗi khi đổi trang để phản ánh thao tác vừa làm
  useEffect(() => {
    if (!me) return;
    api.get<Counts>('/admin/stats').then(setCounts).catch(() => {});
    if (!siteName) api.get<{ site_name: string }>('/site').then((x) => setSiteName(x.site_name)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, loc.pathname]);

  if (me === undefined) return <Loading />;
  if (!me) return <Login setup={setup} onDone={load} />;
  const logout = async () => { await api.post('/admin/logout'); setMe(null); nav('/admin'); };

  return (
    <MeCtx.Provider value={me}>
      <div className="min-h-screen md:grid md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] 2xl:grid-cols-[264px_1fr]">
        <aside className="bg-sunken border-b md:border-b-0 md:border-r border-line md:h-screen md:sticky md:top-0 flex flex-col max-md:sticky max-md:top-0 max-md:z-30 pt-[env(safe-area-inset-top)]">
          <div className="md:hidden flex items-center gap-2 h-14 px-4 border-b border-line">
            <span className="size-8 rounded-lg bg-accent text-white inline-flex items-center justify-center font-serif font-semibold">G</span>
            <span className="font-semibold flex-1 truncate">Quản trị</span>
            <Link to="/" aria-label="Xem trang" className="size-10 inline-flex items-center justify-center rounded-lg text-ink-2 hover:bg-accent-soft hover:text-ink"><ExternalLink aria-hidden className="size-5" /></Link>
            <button onClick={logout} aria-label="Đăng xuất"
              className="size-10 inline-flex items-center justify-center rounded-lg text-ink-2 hover:bg-accent-soft hover:text-ink cursor-pointer"><LogOut aria-hidden className="size-5" /></button>
          </div>
          <div className="hidden md:flex items-center gap-3 px-4 pt-5 pb-3">
            <span className="size-9 shrink-0 rounded bg-accent text-white inline-flex items-center justify-center font-serif font-medium text-lg">{(siteName.trim().charAt(0) || 'G').toUpperCase()}</span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink leading-snug truncate">{siteName || 'Gia phả'}</span>
              <span className="block text-sm text-ink-2">Trang quản trị</span>
            </span>
          </div>
          <nav className="flex md:flex-col gap-1 md:gap-0.5 px-2 py-1.5 md:px-3 md:pb-3 overflow-x-auto md:overflow-y-auto md:flex-1 [scrollbar-width:none]" aria-label="Quản trị">
            {NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.adminOnly || me.role === 'admin') })).filter((g) => g.items.length).map((g, gi) => (
              <div key={gi} className="contents md:block">
                {g.group && <p className="hidden md:block px-3 pt-4 pb-1 text-xs font-medium text-ink-2">{g.group}</p>}
                {g.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end}
                    className={({ isActive }) => cx('group relative h-10 md:h-9 px-3 flex items-center gap-2.5 shrink-0 rounded-md text-[15px] font-medium whitespace-nowrap transition-colors',
                      isActive ? 'bg-surface text-ink shadow-sm ring-1 ring-line [&>svg]:text-ink' : 'text-ink-2 hover:bg-accent-soft hover:text-ink')}>
                    <n.icon aria-hidden className="size-[18px] shrink-0 transition-colors group-hover:text-ink" strokeWidth={1.75} />
                    {n.label}
                    {n.alert && !!counts[n.alert] && (
                      <span className="md:ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-ink text-white text-xs font-semibold tabular-nums"
                        aria-label={`${counts[n.alert]} ${n.alert === 'unread' ? 'thư chưa đọc' : 'bài chờ duyệt'}`}>{counts[n.alert]}</span>
                    )}
                    {n.count && counts[n.count] != null && <span className={cx('hidden md:inline text-sm font-normal tabular-nums', !(n.alert && counts[n.alert]) && 'ml-auto')}>{counts[n.count]}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="hidden md:block p-3 border-t border-line">
            <Link to="/admin/account" className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent-soft transition-colors">
              <span aria-hidden className="size-9 shrink-0 rounded-full bg-accent text-white inline-flex items-center justify-center text-sm font-semibold">{initials(me.display_name || me.username)}</span>
              <span className="min-w-0 leading-tight">
                <span className="block font-medium text-ink truncate">{me.display_name}</span>
                <span className="block text-sm text-ink-2 truncate">{me.role === 'admin' ? 'Quản trị viên' : me.branch ? `Biên tập viên, ${me.branch}` : 'Biên tập viên'}</span>
              </span>
            </Link>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-sm whitespace-nowrap">
              <Link to="/" className="h-9 px-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-ink-2 hover:bg-accent-soft hover:text-ink transition-colors"><ExternalLink aria-hidden className="size-4" />Xem trang</Link>
              <button onClick={logout}
                className="h-9 px-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-ink-2 hover:bg-accent-soft hover:text-ink transition-colors cursor-pointer"><LogOut aria-hidden className="size-4" />Đăng xuất</button>
            </div>
          </div>
        </aside>
        <main className="p-4 sm:p-6 lg:p-8 2xl:px-12 w-full min-w-0">
          <Outlet />
        </main>
      </div>
    </MeCtx.Provider>
  );
}

function Login({ setup, onDone }: { setup: boolean; onDone: () => void }) {
  const [f, setF] = useState({ username: '', password: '', display_name: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (setup) await api.post('/admin/setup', f);
      await api.post('/admin/login', f);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{setup ? 'Tạo tài khoản quản trị' : 'Đăng nhập quản trị'}</h1>
          {setup && <p className="mt-1 text-sm text-ink-2">Lần chạy đầu tiên. Tài khoản này có toàn quyền.</p>}
        </div>
        <Field label="Tên đăng nhập" htmlFor="u">
          <Input id="u" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoFocus />
        </Field>
        {setup && (
          <Field label="Tên hiển thị" htmlFor="dn">
            <Input id="dn" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
          </Field>
        )}
        <Field label="Mật khẩu" htmlFor="p" hint={setup ? 'Tối thiểu 8 ký tự.' : undefined}>
          <PasswordInput id="p" autoComplete={setup ? 'new-password' : 'current-password'} value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Button type="submit" variant="primary" className="w-full" icon={<LogIn aria-hidden />} loading={busy}>{setup ? 'Tạo và đăng nhập' : 'Đăng nhập'}</Button>
        <Link to="/" className="block text-center text-sm text-ink-2 hover:text-ink">Về trang chủ</Link>
      </form>
    </div>
  );
}

/** Upload một ảnh, tự thu nhỏ trước khi gửi. */
export function ImageUpload({ value, onChange, label = 'Ảnh', round }: {
  value: number | null; onChange: (id: number | null) => void; label?: string; round?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await api.upload(await shrinkImage(file));
      onChange(r.id);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const [drag, setDrag] = useState(false);
  return (
    <div className={cx('flex items-center gap-4 rounded-xl p-2 -m-2 transition-colors', drag && 'bg-accent-soft ring-2 ring-accent/40')}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
      <div className={cx('size-20 bg-sunken border border-line overflow-hidden flex items-center justify-center shrink-0', round ? 'rounded-full' : 'rounded-lg')}>
        {busy ? <Spinner /> : value ? <img src={fileUrl(value)} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-ink-3 text-center px-1">Kéo ảnh vào</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label title="Bấm để chọn hoặc kéo thả ảnh vào đây" className="h-9 pointer-coarse:h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface text-sm font-medium cursor-pointer transition-colors hover:bg-sunken hover:border-ink focus-within:ring-2 focus-within:ring-accent">
          <ImageUp aria-hidden className="size-4" />
          {value ? 'Đổi ' + label.toLowerCase() : 'Tải ' + label.toLowerCase()}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Gỡ</Button>}
      </div>
      <span className="sr-only">Hoặc kéo thả ảnh vào đây</span>
    </div>
  );
}
