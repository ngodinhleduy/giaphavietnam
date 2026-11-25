import { useEffect, useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import { Badge, Button, ErrorState, Field, Input, Loading, PageHeader, PasswordInput, StrengthMeter, Textarea, generatePassword, useToast } from '../components/ui.tsx';
import { ImageUpload, useMe } from './AdminLayout.tsx';
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
      <PageHeader title="Cấu hình website" />
      <div className="grid gap-6 xl:grid-cols-2 items-start max-w-[80rem] [&>section:first-child]:xl:col-span-2">
        <Section title="Thông tin trang">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>
    </>
  );
}

function PasscodeSection({ hasPasscode, onSave }: { hasPasscode: boolean; onSave: (b: any) => Promise<void> }) {
  const [code, setCode] = useState('');
  return (
    <Section title="Mã bảo mật phả đồ" hint="Người xem phải nhập mã này mới thấy cây phả hệ, hồ sơ và ngày giỗ. Bài viết, sự kiện và album vẫn công khai.">
      <p className="mb-4">{hasPasscode ? <Badge tone="success">Đang bật</Badge> : <Badge tone="accent">Đang tắt: ai có link cũng xem được phả đồ</Badge>}</p>
      <Field label={hasPasscode ? 'Mã mới' : 'Đặt mã'} htmlFor="pc" hint="Tối thiểu 4 ký tự, dễ đọc qua điện thoại. Đổi mã sẽ khóa lại phả đồ với mọi người đang xem.">
        <div className="flex flex-wrap gap-2">
          <PasswordInput id="pc" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="w-full sm:w-64" />
          <Button type="button" onClick={() => setCode(generatePassword(6).toLowerCase())}>Tạo ngẫu nhiên</Button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2 mt-4">
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

/** Tài khoản của người đang đăng nhập: mọi vai trò đều vào được. */
export function AccountPage() {
  return (
    <>
      <PageHeader title="Tài khoản của tôi" />
      <div className="max-w-[60rem]"><AccountSection /></div>
    </>
  );
}

function AccountSection() {
  const me = useMe();
  const [name, setName] = useState(me?.display_name ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const mismatch = !!pw.confirm && pw.next !== pw.confirm;
  return (
    <Section title="Tài khoản của bạn" hint={`Đăng nhập với tên @${me?.username ?? ''}, vai trò ${me?.role === 'admin' ? 'quản trị viên' : me?.branch ? `biên tập viên (${me.branch})` : 'biên tập viên'}.`}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Tên hiển thị" htmlFor="me-name">
            <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button disabled={!name.trim() || name === me?.display_name} onClick={async () => {
            try { await api.put(`/admin/admins/${me!.id}`, { display_name: name }); toast('Đã lưu. Tải lại trang để cập nhật tên.'); } catch (e: any) { toast(e.message, 'error'); }
          }}>Lưu tên</Button>
        </div>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (mismatch) return;
          setBusy(true);
          try { await api.put('/admin/password', { current: pw.current, next: pw.next }); setPw({ current: '', next: '', confirm: '' }); toast('Đã đổi mật khẩu.'); }
          catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
        }}>
          <Field label="Mật khẩu hiện tại" htmlFor="me-cur" required>
            <PasswordInput id="me-cur" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="Mật khẩu mới" htmlFor="me-new" required hint={<StrengthMeter value={pw.next} />}>
            <PasswordInput id="me-new" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Nhập lại mật khẩu mới" htmlFor="me-conf" required error={mismatch ? 'Hai mật khẩu chưa khớp.' : undefined}>
            <PasswordInput id="me-conf" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} aria-invalid={mismatch} />
          </Field>
          <Button type="submit" variant="primary" loading={busy} disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.confirm}>Đổi mật khẩu</Button>
        </form>
      </div>
    </Section>
  );
}
