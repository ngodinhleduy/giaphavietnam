import { useEffect, useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import { Badge, Button, ErrorState, Field, Input, Loading, PageHeader, Textarea, useToast } from '../components/ui.tsx';
import { ImageUpload } from './AdminLayout.tsx';
import { Section } from './Members.tsx';

export function SettingsAdmin() {
  const { data, error, loading, reload } = useApi<any>('/admin/settings');
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (data) setF(data); }, [data]);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const save = async (body: any) => {
    setBusy(true);
    try {
      await api.put('/admin/settings', body);
      toast('Đã lưu.');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const bind = (k: string) => ({ value: f[k] ?? '', onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  return (
    <>
      <PageHeader title="Cài đặt" />
      <div className="space-y-6 max-w-3xl">
        <Section title="Thông tin trang">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên trang" htmlFor="sn"><Input id="sn" {...bind('site_name')} /></Field>
            <Field label="Khẩu hiệu" htmlFor="st"><Input id="st" {...bind('site_tagline')} /></Field>
            <Field label="Lời giới thiệu (trang chủ)" htmlFor="in" className="sm:col-span-2"><Textarea id="in" rows={4} {...bind('intro')} /></Field>
            <Field label="Địa chỉ nhà thờ họ" htmlFor="ad"><Input id="ad" {...bind('address')} /></Field>
            <Field label="Bản đồ" htmlFor="me" hint="Gõ địa chỉ hoặc dán link nhúng Google Maps."><Input id="me" {...bind('map_embed')} /></Field>
            <Field label="Thông tin liên hệ (chân trang)" htmlFor="ct" className="sm:col-span-2"><Textarea id="ct" rows={3} {...bind('contact')} /></Field>
            <div><p className="text-sm font-medium mb-2">Logo</p><ImageUpload value={f.logo_file_id ? Number(f.logo_file_id) : null} onChange={(v) => setF({ ...f, logo_file_id: v ?? '' })} label="Logo" round /></div>
            <div><p className="text-sm font-medium mb-2">Ảnh nền trang chủ</p><ImageUpload value={f.banner_file_id ? Number(f.banner_file_id) : null} onChange={(v) => setF({ ...f, banner_file_id: v ?? '' })} label="Ảnh nền" /></div>
          </div>
          <Button variant="primary" className="mt-5" loading={busy} onClick={() => save(f)}>Lưu thông tin</Button>
        </Section>
        <PasscodeSection hasPasscode={data.has_passcode} onSave={save} />
        <StorageSection />
        <AccountSection />
      </div>
    </>
  );
}

function PasscodeSection({ hasPasscode, onSave }: { hasPasscode: boolean; onSave: (b: any) => Promise<void> }) {
  const [code, setCode] = useState('');
  return (
    <Section title="Mã bảo mật phả đồ" hint="Người xem phải nhập mã này mới thấy cây phả hệ, hồ sơ và ngày giỗ. Bài viết, sự kiện và album vẫn công khai.">
      <p className="mb-3">{hasPasscode ? <Badge tone="success">Đang bật</Badge> : <Badge tone="accent">Đang tắt: ai cũng xem được phả đồ</Badge>}</p>
      <div className="flex flex-wrap gap-2 items-end">
        <Field label={hasPasscode ? 'Mã mới' : 'Đặt mã'} htmlFor="pc" hint="Tối thiểu 4 ký tự. Đổi mã sẽ đăng xuất mọi người đang xem.">
          <Input id="pc" type="text" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="w-64" />
        </Field>
        <Button variant="primary" disabled={code.length < 4} onClick={async () => { await onSave({ passcode: code }); setCode(''); }}>Lưu mã</Button>
        {hasPasscode && <Button variant="danger" onClick={() => confirm('Tắt mã bảo mật? Ai có link cũng sẽ xem được phả đồ.') && onSave({ passcode: '' })}>Tắt mã</Button>}
      </div>
    </Section>
  );
}

function StorageSection() {
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Lưu trữ file" hint="Ảnh và tài liệu được lưu ở Google Drive hoặc thư mục NAS, cấu hình qua biến môi trường (xem README).">
      <Button loading={busy} onClick={async () => { setBusy(true); setRes(await api.get('/admin/storage/check')); setBusy(false); }}>Kiểm tra kết nối</Button>
      {res && <p role="status" className={`mt-3 text-sm ${res.ok ? 'text-success' : 'text-danger'}`}>{res.message}</p>}
    </Section>
  );
}

function AccountSection() {
  const admins = useApi<any[]>('/admin/admins');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [nu, setNu] = useState({ username: '', password: '', display_name: '' });
  const toast = useToast();
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <Section title="Tài khoản quản trị">
      <ul className="divide-y divide-line border border-line rounded-lg mb-5">
        {admins.data?.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-4 h-12">
            <span>{a.display_name} <span className="text-ink-3 text-sm">@{a.username}</span></span>
            <Button size="sm" variant="ghost" onClick={() => confirm(`Xóa tài khoản ${a.username}?`) && run(async () => { await api.del(`/admin/admins/${a.id}`); admins.reload(); }, 'Đã xóa.')}>Xóa</Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="font-medium text-sm">Đổi mật khẩu của bạn</p>
          <Input type="password" aria-label="Mật khẩu hiện tại" placeholder="Mật khẩu hiện tại" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <Input type="password" aria-label="Mật khẩu mới" placeholder="Mật khẩu mới (8+ ký tự)" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <Button onClick={() => run(async () => { await api.put('/admin/password', pw); setPw({ current: '', next: '' }); }, 'Đã đổi mật khẩu.')}>Đổi mật khẩu</Button>
        </div>
        <div className="space-y-3">
          <p className="font-medium text-sm">Thêm người quản trị</p>
          <Input aria-label="Tên đăng nhập" placeholder="Tên đăng nhập" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          <Input aria-label="Tên hiển thị" placeholder="Tên hiển thị" value={nu.display_name} onChange={(e) => setNu({ ...nu, display_name: e.target.value })} />
          <Input type="password" aria-label="Mật khẩu" placeholder="Mật khẩu (8+ ký tự)" autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <Button onClick={() => run(async () => { await api.post('/admin/admins', nu); setNu({ username: '', password: '', display_name: '' }); admins.reload(); }, 'Đã thêm.')}>Thêm</Button>
        </div>
      </div>
    </Section>
  );
}
