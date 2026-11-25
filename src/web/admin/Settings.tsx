import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, Check, Eye, Globe, HardDrive, Image as ImageIcon, KeyRound, LayoutTemplate, Lock, MapPin, MessageSquareText, Plus, RefreshCw, Save, Sparkles, Trash2, CircleUser, Users } from 'lucide-react';
import { api, useApi } from '../lib/api.ts';
import { TEMPLATES, parsePeople, templateOf, type ContactPerson, type TemplateId } from '../../shared/site.ts';
import { Badge, Button, ErrorState, Field, Input, Loading, PageHeader, PasswordInput, StrengthMeter, Switch, Textarea, buttonClass, cx, generatePassword, useToast } from '../components/ui.tsx';
import { ImageUpload, useMe } from './AdminLayout.tsx';
import { Section } from './Members.tsx';

/** Đọc và lưu bảng settings. Mỗi trang cấu hình chỉ gửi lên các khóa của mình. */
function useSettings() {
  const { data, error, loading, reload } = useApi<any>('/admin/settings');
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = async (body: any, done = 'Đã lưu.') => {
    setBusy(true);
    try {
      await api.put('/admin/settings', body);
      toast(done);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const bind = (k: string) => ({ value: f[k] ?? '', onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  const pick = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, f[k] ?? '']));
  const dirty = (keys: string[]) => !!data && keys.some((k) => String(f[k] ?? '') !== String(data[k] ?? ''));
  return { data, error, loading, reload, f, setF, busy, save, bind, pick, dirty };
}

const GENERAL = ['site_name', 'site_tagline', 'intro'];
export function SettingsAdmin() {
  const st = useSettings();
  if (st.loading) return <Loading />;
  if (st.error) return <ErrorState error={st.error} onRetry={st.reload} />;
  return (
    <>
      <PageHeader title="Cấu hình website" subtitle="Tên trang, lời giới thiệu, mã xem phả đồ." />
      <div className="grid gap-6 xl:grid-cols-2 items-start max-w-[80rem] [&>section:first-child]:xl:col-span-2">
        <Section title="Thông tin trang" icon={<Globe />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên trang" htmlFor="sn"><Input id="sn" {...st.bind('site_name')} /></Field>
            <Field label="Khẩu hiệu" htmlFor="st" hint="Dòng chữ nghiêng phía trên tên trang."><Input id="st" {...st.bind('site_tagline')} /></Field>
            <Field label="Lời giới thiệu" htmlFor="in" className="sm:col-span-2" hint="Hiện ở trang chủ, ngay dưới tên trang."><Textarea id="in" rows={4} {...st.bind('intro')} /></Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="primary" icon={<Save aria-hidden />} loading={st.busy} disabled={!st.dirty(GENERAL)} onClick={() => st.save(st.pick(GENERAL))}>Lưu</Button>
            <p className="text-sm text-ink-2">Logo, ảnh nền và mẫu trang ở mục <Link to="/admin/appearance" className="text-ink underline underline-offset-4">Giao diện</Link>. Địa chỉ, điện thoại ở mục <Link to="/admin/contact" className="text-ink underline underline-offset-4">Trang Liên hệ</Link>.</p>
          </div>
        </Section>
        <PasscodeSection hasPasscode={st.data.has_passcode} onSave={st.save} />
        <StorageSection />
      </div>
    </>
  );
}

// ================= Giao diện: chọn mẫu trang =================
/** Ảnh thu nhỏ vẽ bằng CSS, mô phỏng phần đầu trang chủ của từng mẫu. */
function TemplateThumb({ id }: { id: TemplateId }) {
  const bar = (w: string, tone: string, h = 'h-1.5') => <span className={cx('block rounded-full', h, w, tone)} />;
  const light = id === 'giay-do' || id === 'toi-gian';
  const tone = light ? 'bg-ink' : 'bg-white';
  const sub = light ? 'bg-ink/30' : 'bg-white/45';
  return (
    <span aria-hidden className={cx('relative block aspect-[16/10] overflow-hidden',
      id === 'trong-dong' && 'bg-cham', id === 'giay-do' && 'bg-do', id === 'son' && 'gp-lac !bg-[length:150px_64px]', id === 'toi-gian' && 'bg-white')}>
      {id === 'trong-dong' && <img src="/hoa-tiet/trong-dong.webp" alt="" className="absolute left-1/2 top-1/2 w-[105%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-80" />}
      {id === 'giay-do' && <img src="/hoa-tiet/rong.webp" alt="" className="absolute -right-[8%] top-1/2 w-[72%] -translate-y-1/2 opacity-70" />}
      {id === 'son' && <span className="absolute inset-0 bg-son/55" />}
      <span className={cx('absolute inset-x-0 top-0 h-[13%] flex items-center gap-1 px-[6%]', light ? 'bg-white/80 border-b border-line' : 'bg-black/15')}>
        <span className={cx('size-1.5 rounded-full', tone)} />{bar('w-[16%]', tone, 'h-1')}
        <span className="ml-auto flex gap-1">{bar('w-3', sub, 'h-1')}{bar('w-3', sub, 'h-1')}{bar('w-3', sub, 'h-1')}</span>
      </span>
      <span className={cx('absolute inset-x-[8%] top-[34%] flex flex-col gap-1.5', (id === 'trong-dong' || id === 'son') ? 'items-center' : 'items-start', id === 'giay-do' && 'right-[48%]')}>
        {bar('w-[30%]', sub, 'h-1')}{bar(id === 'giay-do' ? 'w-[92%]' : 'w-[58%]', tone, 'h-2.5')}{bar(id === 'giay-do' ? 'w-[70%]' : 'w-[42%]', sub)}
        <span className="mt-1 flex gap-1">
          <span className={cx('h-2.5 w-8 rounded-sm', light ? 'bg-ink' : 'bg-white')} />
          <span className={cx('h-2.5 w-8 rounded-sm border', light ? 'border-ink/50' : 'border-white/70')} />
        </span>
      </span>
      {id === 'toi-gian' && <span className="absolute inset-x-[8%] bottom-[14%] h-px bg-line-strong" />}
    </span>
  );
}

const LOOK = ['template', 'logo_file_id', 'banner_file_id'];
export function AppearanceAdmin() {
  const st = useSettings();
  if (st.loading) return <Loading />;
  if (st.error) return <ErrorState error={st.error} onRetry={st.reload} />;
  const current = templateOf(st.data.template);
  const chosen = templateOf(st.f.template);
  return (
    <>
      <PageHeader title="Giao diện" subtitle="Chọn mẫu cho trang xem. Nội dung giữ nguyên, chỉ đổi cách trình bày."
        actions={<Button variant="primary" icon={<Save aria-hidden />} loading={st.busy} disabled={!st.dirty(LOOK)}
          onClick={() => st.save(st.pick(LOOK), 'Đã lưu giao diện.')}>Lưu giao diện</Button>} />
      <div className="max-w-[80rem] space-y-6">
        <Section title="Mẫu trang" icon={<LayoutTemplate />}>
          <div role="radiogroup" aria-label="Mẫu trang" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map((t) => {
              const on = chosen === t.id;
              return (
                <div key={t.id} className={cx('rounded-xl border bg-surface overflow-hidden transition-[border-color,box-shadow]', on ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-line-strong hover:shadow-md')}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => st.setF({ ...st.f, template: t.id })} className="block w-full text-left cursor-pointer">
                    <TemplateThumb id={t.id} />
                    <span className="block px-4 pt-3 pb-1">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <span className={cx('size-[18px] shrink-0 rounded-full border-2 inline-flex items-center justify-center', on ? 'border-accent bg-accent text-white' : 'border-line-strong')}>{on && <Check aria-hidden className="size-3" strokeWidth={3} />}</span>
                        {t.name}
                        {current === t.id && <Badge tone="success">Đang dùng</Badge>}
                      </span>
                      <span className="mt-1.5 block text-sm text-ink-2 leading-snug">{t.desc}</span>
                    </span>
                  </button>
                  <a href={`/?mau=${t.id}`} target="_blank" rel="noreferrer" className="mx-4 mb-3 mt-1 inline-flex items-center gap-1.5 min-h-9 text-sm font-medium text-ink-2 hover:text-ink">
                    <Eye aria-hidden className="size-4" />Xem thử<span className="sr-only"> mẫu {t.name} (mở tab mới)</span>
                  </a>
                </div>
              );
            })}
          </div>
          {chosen !== current && <p role="status" className="mt-4 text-sm text-ink-2">Đã chọn mẫu {TEMPLATES.find((t) => t.id === chosen)?.name}. Bấm Lưu giao diện để áp dụng cho mọi người xem.</p>}
        </Section>
        <Section title="Hình ảnh" icon={<ImageIcon />}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-2">Logo</p>
              <ImageUpload value={st.f.logo_file_id ? Number(st.f.logo_file_id) : null} onChange={(v) => st.setF({ ...st.f, logo_file_id: v ?? '' })} label="Logo" round />
              <p className="mt-2 text-sm text-ink-2">Ảnh vuông. Chưa có thì hiện chữ cái đầu của tên họ.</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Ảnh nền trang chủ</p>
              <ImageUpload value={st.f.banner_file_id ? Number(st.f.banner_file_id) : null} onChange={(v) => st.setF({ ...st.f, banner_file_id: v ?? '' })} label="Ảnh nền" />
              <p className="mt-2 text-sm text-ink-2">Có ảnh nền thì ảnh thay cho họa tiết của mẫu. Mẫu Tối giản không dùng ảnh nền.</p>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}

// ================= Trang Liên hệ =================
const CONTACT = ['contact_intro', 'contact_people', 'contact_email', 'contact_zalo', 'contact_facebook', 'contact_form', 'address', 'map_embed', 'contact'];
export function ContactAdmin() {
  const st = useSettings();
  const [people, setPeople] = useState<ContactPerson[]>([]);
  useEffect(() => { if (st.data) setPeople(parsePeople(st.data.contact_people)); }, [st.data]);
  if (st.loading) return <Loading />;
  if (st.error) return <ErrorState error={st.error} onRetry={st.reload} />;
  const setP = (i: number, p: Partial<ContactPerson>) => setPeople((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const formOn = st.f.contact_form !== '0';
  const peopleDirty = JSON.stringify(parsePeople(people)) !== JSON.stringify(parsePeople(st.data.contact_people));
  const save = () => st.save({ ...st.pick(CONTACT), contact_people: people, contact_form: formOn ? '1' : '0' }, 'Đã lưu trang Liên hệ.');
  return (
    <>
      <PageHeader title="Trang Liên hệ" subtitle="Thông tin hiện ở trang Liên hệ và chân trang."
        actions={<>
          <a href="/lien-he" target="_blank" rel="noreferrer" className={buttonClass('secondary')}><Eye aria-hidden />Xem trang</a>
          <Button variant="primary" icon={<Save aria-hidden />} loading={st.busy} disabled={!st.dirty(CONTACT) && !peopleDirty} onClick={save}>Lưu</Button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2 items-start max-w-[80rem]">
        <Section title="Người liên hệ" icon={<Users />} hint="Tối đa 8 người. Số điện thoại hiện công khai, chỉ ghi khi người đó đồng ý.">
          {!people.length && <p className="mb-3 text-sm text-ink-2">Chưa có ai. Thêm trưởng họ hoặc người giữ gia phả.</p>}
          <ul className="space-y-3">
            {people.map((p, i) => (
              <li key={i} className="grid gap-2 grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_9.5rem_auto] items-center">
                <Input aria-label={`Họ tên người liên hệ ${i + 1}`} placeholder="Họ tên" value={p.name} maxLength={80} onChange={(e) => setP(i, { name: e.target.value })} className="max-sm:col-span-2" />
                <Input aria-label={`Vai trò của người liên hệ ${i + 1}`} placeholder="Vai trò, ví dụ Trưởng họ" value={p.role} maxLength={80} onChange={(e) => setP(i, { role: e.target.value })} className="max-sm:col-span-2" />
                <Input aria-label={`Điện thoại của người liên hệ ${i + 1}`} placeholder="Điện thoại" inputMode="tel" value={p.phone} maxLength={30} onChange={(e) => setP(i, { phone: e.target.value })} />
                <Button variant="ghost" className="hover:text-danger px-2.5" icon={<Trash2 aria-hidden />} aria-label={`Gỡ ${p.name || `người liên hệ ${i + 1}`}`} onClick={() => setPeople((l) => l.filter((_, k) => k !== i))} />
              </li>
            ))}
          </ul>
          {people.length < 8 && <Button className="mt-3" icon={<Plus aria-hidden />} onClick={() => setPeople((l) => [...l, { name: '', role: '', phone: '' }])}>Thêm người</Button>}
        </Section>

        <Section title="Kênh liên hệ" icon={<AtSign />}>
          <div className="grid gap-4">
            <Field label="Email" htmlFor="c-email" optional><Input id="c-email" type="email" inputMode="email" placeholder="banlienlac@example.com" {...st.bind('contact_email')} /></Field>
            <Field label="Nhóm Zalo" htmlFor="c-zalo" optional hint="Dán link mời vào nhóm, bắt đầu bằng https://"><Input id="c-zalo" inputMode="url" placeholder="https://zalo.me/g/..." {...st.bind('contact_zalo')} /></Field>
            <Field label="Facebook" htmlFor="c-fb" optional><Input id="c-fb" inputMode="url" placeholder="https://facebook.com/..." {...st.bind('contact_facebook')} /></Field>
          </div>
        </Section>

        <Section title="Nhà thờ họ" icon={<MapPin />}>
          <div className="grid gap-4">
            <Field label="Địa chỉ" htmlFor="ad"><Input id="ad" {...st.bind('address')} /></Field>
            <Field label="Bản đồ" htmlFor="me" hint="Gõ địa chỉ hoặc dán link nhúng Google Maps. Hiện ở trang chủ và trang Liên hệ."><Input id="me" {...st.bind('map_embed')} /></Field>
          </div>
        </Section>

        <Section title="Lời nhắn" icon={<MessageSquareText />}>
          <div className="grid gap-4">
            <Switch label="Nhận lời nhắn qua form" checked={formOn} onChange={(v) => st.setF({ ...st.f, contact_form: v ? '1' : '0' })}
              description={formOn ? 'Người xem gửi được lời nhắn. Thư vào mục Hòm thư.' : 'Ẩn form. Trang chỉ còn thông tin liên hệ.'} />
            <Field label="Lời dẫn đầu trang" htmlFor="c-intro" optional hint="Để trống thì dùng câu mặc định."><Textarea id="c-intro" rows={3} maxLength={400} {...st.bind('contact_intro')} /></Field>
            <Field label="Ghi chú ở chân trang" htmlFor="ct" optional hint="Một hai dòng ngắn, hiện ở cột Liên hệ cuối mỗi trang."><Textarea id="ct" rows={2} {...st.bind('contact')} /></Field>
          </div>
        </Section>
      </div>
    </>
  );
}

function PasscodeSection({ hasPasscode, onSave }: { hasPasscode: boolean; onSave: (b: any) => Promise<void> }) {
  const [code, setCode] = useState('');
  return (
    <Section title="Mã bảo mật phả đồ" icon={<Lock />} hint="Người xem phải nhập mã này mới thấy cây phả hệ, hồ sơ và ngày giỗ. Bài viết, sự kiện và album vẫn công khai.">
      <p className="mb-4">{hasPasscode ? <Badge tone="success">Đang bật</Badge> : <Badge tone="accent">Đang tắt: ai có link cũng xem được phả đồ</Badge>}</p>
      <Field label={hasPasscode ? 'Mã mới' : 'Đặt mã'} htmlFor="pc" hint="Tối thiểu 4 ký tự, dễ đọc qua điện thoại. Đổi mã sẽ khóa lại phả đồ với mọi người đang xem.">
        <div className="flex flex-wrap gap-2">
          <PasswordInput id="pc" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="w-full sm:w-64" />
          <Button type="button" icon={<Sparkles aria-hidden />} onClick={() => setCode(generatePassword(6).toLowerCase())}>Tạo ngẫu nhiên</Button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="primary" icon={<KeyRound aria-hidden />} disabled={code.length < 4} onClick={async () => { await onSave({ passcode: code }); setCode(''); }}>Lưu mã</Button>
        {hasPasscode && <Button variant="danger" onClick={() => confirm('Tắt mã bảo mật? Ai có link cũng sẽ xem được phả đồ.') && onSave({ passcode: '' })}>Tắt mã</Button>}
      </div>
    </Section>
  );
}

function StorageSection() {
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Lưu trữ file" icon={<HardDrive />} hint="Ảnh và tài liệu được lưu ở Google Drive hoặc thư mục NAS, cấu hình qua biến môi trường (xem README).">
      <Button loading={busy} icon={<RefreshCw aria-hidden />} onClick={async () => { setBusy(true); setRes(await api.get('/admin/storage/check')); setBusy(false); }}>Kiểm tra kết nối</Button>
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
    <Section title="Tài khoản của bạn" icon={<CircleUser />} hint={`Đăng nhập với tên @${me?.username ?? ''}, vai trò ${me?.role === 'admin' ? 'quản trị viên' : me?.branch ? `biên tập viên (${me.branch})` : 'biên tập viên'}.`}>
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
