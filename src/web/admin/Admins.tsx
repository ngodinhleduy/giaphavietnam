import { useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import {
  Badge, Button, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, PasswordInput, Segmented, StrengthMeter,
  generatePassword, useToast,
} from '../components/ui.tsx';
import { useMe } from './AdminLayout.tsx';

type Role = 'admin' | 'editor';
type Admin = { id: number; username: string; display_name: string; created_at: string; last_login_at: string | null; role: Role; branch: string | null };
const roleLabel = (a: Pick<Admin, 'role' | 'branch'>) => (a.role === 'admin' ? 'Quản trị viên' : a.branch ? `Biên tập viên · ${a.branch}` : 'Biên tập viên');
const ROLES: { value: Role; label: string }[] = [{ value: 'admin', label: 'Quản trị viên' }, { value: 'editor', label: 'Biên tập viên' }];

/** Chọn vai trò, kèm giới hạn theo chi cho biên tập viên. */
function RoleFields({ role, branch, onChange, idPrefix }: { role: Role; branch: string; onChange: (p: { role?: Role; branch?: string }) => void; idPrefix: string }) {
  return (
    <>
      <Field label="Vai trò" hint={role === 'admin'
        ? 'Toàn quyền: phả đồ, bài viết, cấu hình, menu, hòm thư, tài khoản khác.'
        : 'Sửa phả đồ, thành viên, sự kiện, album. Bài viết phải chờ quản trị viên duyệt mới đăng. Không vào được cấu hình, menu, hòm thư, nhật ký, tài khoản.'}>
        <Segmented label="Vai trò" value={role} onChange={(v) => onChange({ role: v })} options={ROLES} />
      </Field>
      {role === 'editor' && (
        <Field label="Chỉ được sửa chi" htmlFor={`${idPrefix}-branch`} optional
          hint="Để trống: sửa được mọi thành viên. Ghi tên chi (đúng như trường Chi trong hồ sơ) để giới hạn người này trong một chi.">
          <Input id={`${idPrefix}-branch`} maxLength={60} value={branch} onChange={(e) => onChange({ branch: e.target.value })} placeholder="Ví dụ: Chi 2" />
        </Field>
      )}
    </>
  );
}

/** Thời gian SQLite (UTC) sang giờ Việt Nam, dạng tương đối khi gần. */
export function when(s: string | null) {
  if (!s) return 'Chưa đăng nhập';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
const dateOnly = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function AdminsAdmin() {
  const me = useMe();
  const { data, error, loading, reload } = useApi<Admin[]>('/admin/admins');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [resetting, setResetting] = useState<Admin | null>(null);
  const [removing, setRemoving] = useState<Admin | null>(null);
  const toast = useToast();
  const count = data?.length ?? 0;

  return (
    <>
      <PageHeader title="Người quản lý" subtitle={data ? `${count} tài khoản, ${data.filter((a) => a.role === 'admin').length} quản trị viên` : undefined}
        actions={<Button variant="primary" onClick={() => setAdding(true)}>Thêm tài khoản</Button>} />
      <p className="-mt-3 mb-6 text-sm text-ink-2 max-w-2xl">
        Quản trị viên có toàn quyền, kể cả với các tài khoản khác. Biên tập viên chỉ nhập liệu: phả đồ, sự kiện, album, và bài viết ở dạng chờ duyệt. Có thể giới hạn biên tập viên trong một chi.
      </p>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? <EmptyState title="Chưa có quản trị viên" /> : (
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          {/* Mobile: dạng thẻ */}
          <ul className="md:hidden divide-y divide-line">
            {data.map((a) => (
              <li key={a.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="size-10 shrink-0 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center font-semibold">
                    {a.display_name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.display_name} {a.id === me?.id && <Badge tone="accent">Bạn</Badge>}</p>
                    <p className="text-sm text-ink-2">{roleLabel(a)} · @{a.username} · {when(a.last_login_at)}</p>
                  </div>
                </div>
                <RowActions a={a} self={a.id === me?.id} last={count <= 1}
                  onEdit={() => setEditing(a)} onReset={() => setResetting(a)} onRemove={() => setRemoving(a)} />
              </li>
            ))}
          </ul>
          {/* Desktop: bảng */}
          <table className="hidden md:table w-full text-[15px]">
            <thead className="text-left text-sm text-ink-2 bg-sunken/60">
              <tr>
                <th className="font-medium px-4 h-11">Người quản trị</th>
                <th className="font-medium px-4">Vai trò</th>
                <th className="font-medium px-4">Tên đăng nhập</th>
                <th className="font-medium px-4">Ngày tạo</th>
                <th className="font-medium px-4">Đăng nhập gần nhất</th>
                <th className="font-medium px-4 text-right"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((a) => (
                <tr key={a.id} className="hover:bg-sunken/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-9 shrink-0 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center font-semibold text-sm">
                        {a.display_name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium">{a.display_name}</span>
                      {a.id === me?.id && <Badge tone="accent">Bạn</Badge>}
                    </div>
                  </td>
                  <td className="px-4">{roleLabel(a)}</td>
                  <td className="px-4 text-ink-2">@{a.username}</td>
                  <td className="px-4 text-ink-2 tabular-nums">{dateOnly(a.created_at)}</td>
                  <td className="px-4 text-ink-2">{when(a.last_login_at)}</td>
                  <td className="px-4"><RowActions a={a} self={a.id === me?.id} last={count <= 1} inline
                    onEdit={() => setEditing(a)} onReset={() => setResetting(a)} onRemove={() => setRemoving(a)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddAdminModal open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />

      <EditNameModal admin={editing} self={editing?.id === me?.id} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />

      <ResetPasswordModal admin={resetting} onClose={() => setResetting(null)} />

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Xóa tài khoản?"
        footer={<>
          <Button onClick={() => setRemoving(null)}>Hủy</Button>
          <Button variant="danger" onClick={async () => {
            try { await api.del(`/admin/admins/${removing!.id}`); toast('Đã xóa.'); reload(); } catch (e: any) { toast(e.message, 'error'); }
            setRemoving(null);
          }}>Xóa tài khoản</Button>
        </>}>
        <p className="text-ink-2"><b className="text-ink">{removing?.display_name}</b> (@{removing?.username}) sẽ không đăng nhập được nữa. Dữ liệu phả đồ không bị ảnh hưởng.</p>
      </Modal>
    </>
  );
}

function RowActions({ a, self, last, inline, onEdit, onReset, onRemove }: {
  a: Admin; self: boolean; last: boolean; inline?: boolean; onEdit: () => void; onReset: () => void; onRemove: () => void;
}) {
  return (
    <div className={inline ? 'flex justify-end gap-1' : 'flex flex-wrap gap-2 mt-3 pl-[3.25rem]'}>
      <Button size="sm" variant={inline ? 'ghost' : 'secondary'} onClick={onEdit}>{self ? 'Đổi tên' : 'Sửa'}</Button>
      {!self && <Button size="sm" variant={inline ? 'ghost' : 'secondary'} onClick={onReset}>Đặt lại mật khẩu</Button>}
      {!self && !last && <Button size="sm" variant={inline ? 'ghost' : 'secondary'} className="text-danger" onClick={onRemove}
        aria-label={`Xóa ${a.display_name}`}>Xóa</Button>}
    </div>
  );
}

/** Ô mật khẩu kèm nút tạo ngẫu nhiên và sao chép. */
export function NewPasswordField({ id, value, onChange, label = 'Mật khẩu' }: {
  id: string; value: string; onChange: (v: string) => void; label?: string;
}) {
  const toast = useToast();
  return (
    <Field label={label} htmlFor={id} required hint={<>
      <StrengthMeter value={value} />
      <span className="block mt-1">Tối thiểu 8 ký tự. Gửi mật khẩu cho người dùng qua kênh riêng và nhắc họ đổi sau khi đăng nhập.</span>
    </>}>
      <div className="flex gap-2">
        <PasswordInput id={id} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
        <Button type="button" onClick={() => onChange(generatePassword())}>Tạo ngẫu nhiên</Button>
        {value && <Button type="button" variant="ghost" aria-label="Sao chép mật khẩu"
          onClick={async () => { await navigator.clipboard.writeText(value); toast('Đã sao chép mật khẩu.'); }}>Sao chép</Button>}
      </div>
    </Field>
  );
}

function AddAdminModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const F0 = { display_name: '', username: '', password: '', role: 'editor' as Role, branch: '' };
  const [f, setF] = useState(F0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.post('/admin/admins', f);
      toast(`Đã thêm ${f.display_name || f.username}.`);
      setF(F0);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Thêm tài khoản" width="max-w-xl"
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy} onClick={submit}
        disabled={!f.username || f.password.length < 8}>Thêm</Button></>}>
      <div className="space-y-4">
        <Field label="Tên hiển thị" htmlFor="na-name" hint="Ví dụ: Bác Hùng, chi trưởng.">
          <Input id="na-name" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
        </Field>
        <Field label="Tên đăng nhập" htmlFor="na-user" required hint="Chữ không dấu, số, dấu chấm hoặc gạch dưới.">
          <Input id="na-user" autoComplete="off" autoCapitalize="none" spellCheck={false} value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value.replace(/\s/g, '') })} />
        </Field>
        <RoleFields idPrefix="na" role={f.role} branch={f.branch} onChange={(p) => setF({ ...f, ...p })} />
        <NewPasswordField id="na-pass" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

function EditNameModal({ admin, self, onClose, onDone }: { admin: Admin | null; self: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<{ role: Role; branch: string }>({ role: 'admin', branch: '' });
  const toast = useToast();
  const [prev, setPrev] = useState<number | null>(null);
  if (admin && prev !== admin.id) { setPrev(admin.id); setName(admin.display_name); setRole({ role: admin.role, branch: admin.branch ?? '' }); }
  return (
    <Modal open={!!admin} onClose={() => { setPrev(null); onClose(); }} title={self ? 'Đổi tên hiển thị' : `Sửa tài khoản @${admin?.username ?? ''}`} width="max-w-xl"
      footer={<><Button onClick={() => { setPrev(null); onClose(); }}>Hủy</Button><Button variant="primary" disabled={!name.trim()} onClick={async () => {
        try { await api.put(`/admin/admins/${admin!.id}`, self ? { display_name: name } : { display_name: name, ...role }); toast('Đã lưu.'); setPrev(null); onDone(); } catch (e: any) { toast(e.message, 'error'); }
      }}>Lưu</Button></>}>
      <div className="space-y-4">
        <Field label="Tên hiển thị" htmlFor="en-name" required>
          <Input id="en-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!self && <RoleFields idPrefix="en" role={role.role} branch={role.branch} onChange={(p) => setRole((r) => ({ ...r, ...p }))} />}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ admin, onClose }: { admin: Admin | null; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open={!!admin} onClose={() => { setPw(''); onClose(); }} title={`Đặt lại mật khẩu cho ${admin?.display_name ?? ''}`} width="max-w-xl"
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy} disabled={pw.length < 8} onClick={async () => {
        setBusy(true);
        try { await api.put(`/admin/admins/${admin!.id}/password`, { password: pw }); toast('Đã đặt lại mật khẩu.'); setPw(''); onClose(); }
        catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
      }}>Đặt lại</Button></>}>
      <NewPasswordField id="rp-pass" label="Mật khẩu mới" value={pw} onChange={setPw} />
    </Modal>
  );
}
