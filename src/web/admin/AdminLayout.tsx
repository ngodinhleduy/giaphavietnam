import { createContext, useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, fileUrl, shrinkImage } from '../lib/api.ts';
import { Button, Field, Input, Loading, Spinner, cx, useToast } from '../components/ui.tsx';

type Me = { id: number; username: string; display_name: string };
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);

const NAV = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/members', label: 'Thành viên' },
  { to: '/admin/articles', label: 'Bài viết' },
  { to: '/admin/events', label: 'Sự kiện' },
  { to: '/admin/albums', label: 'Album ảnh' },
  { to: '/admin/settings', label: 'Cài đặt' },
];

export function AdminLayout() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [setup, setSetup] = useState(false);
  const nav = useNavigate();
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

  if (me === undefined) return <Loading />;
  if (!me) return <Login setup={setup} onDone={load} />;

  return (
    <MeCtx.Provider value={me}>
      <div className="min-h-screen md:grid md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] 2xl:grid-cols-[264px_1fr]">
        <aside className="bg-surface border-b md:border-b-0 md:border-r border-line md:h-screen md:sticky md:top-0 flex flex-col max-md:sticky max-md:top-0 max-md:z-30 pt-[env(safe-area-inset-top)]">
          <div className="md:hidden flex items-center gap-2 h-14 px-4 border-b border-line">
            <span className="size-8 rounded-lg bg-accent text-white inline-flex items-center justify-center font-serif font-semibold">G</span>
            <span className="font-semibold flex-1 truncate">Quản trị</span>
            <Link to="/" className="h-10 px-3 inline-flex items-center rounded-lg text-sm text-ink-2 hover:bg-sunken">Xem trang</Link>
            <button onClick={async () => { await api.post('/admin/logout'); setMe(null); nav('/admin'); }}
              className="h-10 px-3 rounded-lg text-sm text-ink-2 hover:bg-sunken cursor-pointer">Đăng xuất</button>
          </div>
          <div className="hidden md:flex items-center gap-2 h-16 px-5 border-b border-line">
            <span className="size-8 rounded-lg bg-accent text-white inline-flex items-center justify-center font-serif font-semibold">G</span>
            <span className="font-semibold">Quản trị</span>
          </div>
          <nav className="flex md:flex-col gap-1 px-2 py-1.5 md:p-3 overflow-x-auto md:flex-1 [scrollbar-width:none]" aria-label="Quản trị">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx('h-10 px-3 inline-flex items-center shrink-0 rounded-lg text-[15px] font-medium whitespace-nowrap',
                  isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-sunken hover:text-ink')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:block p-3 border-t border-line text-sm">
            <p className="px-2 text-ink-2 truncate">{me.display_name}</p>
            <div className="mt-2 flex gap-1">
              <Link to="/" className="h-9 px-2 inline-flex items-center rounded-lg text-ink-2 hover:bg-sunken hover:text-ink">Xem trang</Link>
              <button onClick={async () => { await api.post('/admin/logout'); setMe(null); nav('/admin'); }}
                className="h-9 px-2 rounded-lg text-ink-2 hover:bg-sunken hover:text-ink cursor-pointer">Đăng xuất</button>
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
          <Input id="p" type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={busy}>{setup ? 'Tạo và đăng nhập' : 'Đăng nhập'}</Button>
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
  return (
    <div className="flex items-center gap-4">
      <div className={cx('size-20 bg-sunken border border-line overflow-hidden flex items-center justify-center shrink-0', round ? 'rounded-full' : 'rounded-lg')}>
        {busy ? <Spinner /> : value ? <img src={fileUrl(value)} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-ink-3">Chưa có</span>}
      </div>
      <div className="flex gap-2">
        <label className="h-9 pointer-coarse:h-11 px-3 inline-flex items-center rounded-lg border border-line-strong bg-surface text-sm font-medium cursor-pointer hover:bg-sunken focus-within:ring-2 focus-within:ring-accent">
          {value ? 'Đổi ' + label.toLowerCase() : 'Tải ' + label.toLowerCase()}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Gỡ</Button>}
      </div>
    </div>
  );
}
