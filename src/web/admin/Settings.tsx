import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AtSign, BookOpenText, Check, CircleUser, Eye, HardDrive, Image as ImageIcon, KeyRound, Landmark, LayoutTemplate, Lock, MapPin, MessageSquareText,
  Palette, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Users,
} from 'lucide-react';
import { api, useApi } from '../lib/api.ts';
import { TEMPLATES, parsePeople, templateOf, type ContactPerson, type TemplateId } from '../../shared/site.ts';
import { Badge, Button, ErrorState, Field, Input, Loading, PageHeader, PasswordInput, StrengthMeter, Switch, Textarea, buttonClass, cx, generatePassword, useToast } from '../components/ui.tsx';
import { defaultPrivacy } from '../../shared/privacy.ts';
import { ImageUpload, useMe } from './AdminLayout.tsx';
import { Section } from './Members.tsx';

const RichEditor = lazy(() => import('../components/RichEditor.tsx'));

// Mọi khóa do trang này lưu. Một nút Lưu chung cho cả sáu tab, giống cách người dùng nghĩ: "lưu cấu hình".
const KEYS = ['site_name', 'site_tagline', 'intro', 'foreword', 'banner_file_id', 'intro_image_file_id', 'logo_file_id', 'favicon_file_id',
  'address', 'map_embed', 'contact', 'contact_intro', 'contact_email', 'contact_phone', 'contact_zalo', 'contact_facebook', 'contact_form',
  'template', 'tree_lines', 'privacy'];
const TABS = [
  { id: 'general', label: 'Thông tin', icon: Landmark },
  { id: 'images', label: 'Logo và biểu tượng', icon: ImageIcon },
  { id: 'contact', label: 'Liên hệ và bản đồ', icon: MapPin },
  { id: 'template', label: 'Giao diện', icon: Palette },
  { id: 'display', label: 'Hiển thị', icon: SlidersHorizontal },
  { id: 'privacy', label: 'Chính sách bảo mật', icon: ShieldCheck },
  { id: 'security', label: 'Bảo mật và lưu trữ', icon: Lock },
] as const;
type TabId = (typeof TABS)[number]['id'];
/** Dán cả thẻ iframe thì chỉ giữ địa chỉ trong src; gõ địa chỉ thường thì giữ nguyên. */
const mapValue = (v: string) => (v.match(/src="([^"]+)"/)?.[1] ?? v).trim();
const mapSrc = (v: string) => {
  const m = v.match(/src="([^"]+)"/); // dán cả thẻ iframe của Google Maps cũng nhận
  const u = (m ? m[1] : v).trim();
  return /^https?:\/\//.test(u) ? u : `https://www.google.com/maps?q=${encodeURIComponent(u)}&output=embed`;
};

export function SettingsAdmin() {
  const { data, error, loading, reload } = useApi<any>('/admin/settings');
  const [f, setF] = useState<any>({});
  const [people, setPeople] = useState<ContactPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [privacyKey, setPrivacyKey] = useState(0); // đổi key để trình soạn thảo nạp lại nội dung vừa chép vào
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  useEffect(() => { if (data) { setF(data); setPeople(parsePeople(data.contact_people)); } }, [data]);
  // Bản đồ xem trước chỉ đổi khi rời ô nhập, để không tải lại iframe theo từng ký tự
  const [mapPreview, setMapPreview] = useState('');
  useEffect(() => { if (data) setMapPreview(data.map_embed ?? ''); }, [data]);

  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'general';
  // Trên màn hẹp thanh tab cuộn ngang: đưa tab đang mở vào giữa
  useEffect(() => { document.getElementById(`tab-${tab}`)?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [tab, data]);
  const dirty = !!data && (KEYS.some((k) => String(f[k] ?? '') !== String(data[k] ?? ''))
    || JSON.stringify(parsePeople(people)) !== JSON.stringify(parsePeople(data.contact_people)));
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? 'Lỗi'} onRetry={reload} />;

  const bind = (k: string) => ({ value: f[k] ?? '', onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  const file = (k: string) => ({ value: f[k] ? Number(f[k]) : null, onChange: (v: number | null) => setF({ ...f, [k]: v ?? '' }) });
  const save = async (body?: any) => {
    setBusy(true);
    try {
      await api.put('/admin/settings', body ?? { ...Object.fromEntries(KEYS.map((k) => [k, f[k] ?? ''])), map_embed: mapValue(f.map_embed ?? ''), contact_people: people });
      toast('Đã lưu cấu hình.');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const setP = (i: number, p: Partial<ContactPerson>) => setPeople((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const formOn = f.contact_form !== '0';
  const privacyText = String(f.privacy ?? '').replace(/<[^>]*>/g, '').trim();
  const current = templateOf(data.template);
  const chosen = templateOf(f.template);
  const lines = ['curve', 'straight'].includes(f.tree_lines) ? f.tree_lines : 'ortho';

  return (
    <div className="pb-24">
      <PageHeader title="Cấu hình website" subtitle="Tên, hình ảnh, liên hệ và cách trình bày của trang xem." />
      <div role="tablist" aria-label="Nhóm cấu hình" className="flex gap-1 mb-6 border-b border-line overflow-x-auto [scrollbar-width:none]">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="settings-panel"
            onClick={() => setParams(t.id === 'general' ? {} : { tab: t.id }, { replace: true })}
            className={cx('relative shrink-0 h-11 px-3 inline-flex items-center gap-2 text-[15px] font-medium whitespace-nowrap cursor-pointer transition-colors rounded-t-md',
              tab === t.id ? 'text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent' : 'text-ink-2 hover:text-ink hover:bg-sunken')}>
            <t.icon aria-hidden className="size-[18px]" strokeWidth={1.75} />{t.label}
          </button>
        ))}
      </div>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="max-w-[80rem]">
        {tab === 'general' && (
          <div className="grid gap-6">
            <Section title="Thông tin gia phả" icon={<Landmark />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên trang" htmlFor="sn" hint="Hiện ở đầu trang và trên tab trình duyệt."><Input id="sn" {...bind('site_name')} /></Field>
                <Field label="Khẩu hiệu" htmlFor="st" hint="Dòng chữ nghiêng phía trên tên trang."><Input id="st" {...bind('site_tagline')} /></Field>
                <Field label="Lời giới thiệu ngắn" htmlFor="in" className="sm:col-span-2" hint="Một hai câu, hiện ngay dưới tên trang ở trang chủ."><Textarea id="in" rows={3} {...bind('intro')} /></Field>
              </div>
            </Section>
            <Section title="Lời nói đầu" icon={<BookOpenText />} hint="Bài giới thiệu về dòng họ, hiện thành một khối riêng ở trang chủ. Để trống thì khối này ẩn.">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <Suspense fallback={<div className="h-64 rounded-lg border border-line-strong bg-surface animate-pulse" />}>
                  <RichEditor value={f.foreword ?? ''} onChange={(v) => setF((x: any) => ({ ...x, foreword: v }))} minHeight={260} placeholder="Viết lời nói đầu..." />
                </Suspense>
                <div>
                  <p className="text-sm font-medium mb-2">Ảnh đi kèm lời nói đầu</p>
                  <ImageUpload {...file('intro_image_file_id')} label="Ảnh" />
                  <p className="mt-2 text-sm text-ink-2">Ví dụ ảnh nhà thờ họ hoặc ảnh họp họ.</p>
                </div>
              </div>
            </Section>
          </div>
        )}

        {tab === 'privacy' && (
          <Section title="Chính sách bảo mật" icon={<ShieldCheck />}
            hint={<>Hiện ở trang <a href="/chinh-sach-bao-mat" target="_blank" rel="noreferrer" className="underline underline-offset-4 text-ink hover:text-accent">/chinh-sach-bao-mat</a>, có liên kết ở chân mọi trang. Để trống thì trang dùng bản mặc định.</>}>
            <div className="mt-1 mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={privacyText ? 'accent' : 'neutral'}>{privacyText ? 'Đang dùng bản riêng' : 'Đang dùng bản mặc định'}</Badge>
              <Button size="sm" icon={<RotateCcw aria-hidden />} onClick={() => { setF((x: any) => ({ ...x, privacy: defaultPrivacy(f.site_name || 'gia phả', f.contact_phone || f.contact_email || '') })); setPrivacyKey((k) => k + 1); }}>
                {privacyText ? 'Thay bằng bản mặc định' : 'Chép bản mặc định vào để sửa'}
              </Button>
              {privacyText && <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden />} onClick={() => { setF((x: any) => ({ ...x, privacy: '' })); setPrivacyKey((k) => k + 1); }}>Xóa bản riêng</Button>}
            </div>
            <Suspense fallback={<div className="h-80 rounded-lg border border-line-strong bg-surface animate-pulse" />}>
              <RichEditor key={privacyKey} value={f.privacy ?? ''} onChange={(v) => setF((x: any) => ({ ...x, privacy: v }))} minHeight={360} placeholder="Viết chính sách bảo mật, hoặc chép bản mặc định vào để sửa..." />
            </Suspense>
          </Section>
        )}

        {tab === 'images' && (
          <Section title="Logo và biểu tượng" icon={<ImageIcon />}>
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium mb-2">Logo</p>
                <ImageUpload {...file('logo_file_id')} label="Logo" round />
                <p className="mt-2 text-sm text-ink-2">Ảnh vuông. Chưa có thì hiện chữ cái đầu của tên họ.</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Favicon</p>
                <ImageUpload {...file('favicon_file_id')} label="Favicon" />
                <p className="mt-2 text-sm text-ink-2">Biểu tượng trên tab trình duyệt. Ảnh vuông, nét đơn giản.</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Ảnh nền trang chủ</p>
                <ImageUpload {...file('banner_file_id')} label="Ảnh nền" />
                <p className="mt-2 text-sm text-ink-2">Thay cho họa tiết của mẫu trang. Mẫu Tối giản không dùng.</p>
              </div>
            </div>
          </Section>
        )}

        {tab === 'contact' && (
          <div className="grid gap-6 xl:grid-cols-2 items-start">
            <Section title="Nhà thờ họ và bản đồ" icon={<MapPin />}>
              <div className="grid gap-4">
                <Field label="Địa chỉ" htmlFor="ad"><Input id="ad" {...bind('address')} /></Field>
                <Field label="Bản đồ" htmlFor="me" hint="Gõ địa chỉ, hoặc vào Google Maps: Chia sẻ, Nhúng bản đồ, Sao chép HTML rồi dán vào đây.">
                  <Textarea id="me" rows={2} className="font-mono text-sm" {...bind('map_embed')} onBlur={() => setMapPreview(f.map_embed ?? '')} />
                </Field>
                {mapPreview ? (
                  <iframe title="Xem trước bản đồ" className="w-full h-56 rounded-lg border border-line" loading="lazy" src={mapSrc(mapPreview)} />
                ) : <p className="text-sm text-ink-2">Chưa có bản đồ. Bản xem trước hiện khi bạn rời ô nhập.</p>}
              </div>
            </Section>
            <Section title="Kênh liên hệ" icon={<AtSign />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số điện thoại" htmlFor="c-phone" optional><Input id="c-phone" inputMode="tel" {...bind('contact_phone')} /></Field>
                <Field label="Email" htmlFor="c-email" optional><Input id="c-email" type="email" inputMode="email" {...bind('contact_email')} /></Field>
                <Field label="Nhóm Zalo" htmlFor="c-zalo" optional hint="Link bắt đầu bằng https://"><Input id="c-zalo" inputMode="url" placeholder="https://zalo.me/g/..." {...bind('contact_zalo')} /></Field>
                <Field label="Facebook" htmlFor="c-fb" optional><Input id="c-fb" inputMode="url" placeholder="https://facebook.com/..." {...bind('contact_facebook')} /></Field>
                <Field label="Ghi chú ở chân trang" htmlFor="ct" optional className="sm:col-span-2"><Textarea id="ct" rows={2} {...bind('contact')} /></Field>
              </div>
            </Section>
            <Section title="Người liên hệ" icon={<Users />} hint="Tối đa 8 người. Số điện thoại hiện công khai, chỉ ghi khi người đó đồng ý.">
              <ul className="space-y-3">
                {people.map((p, i) => (
                  <li key={i} className="grid gap-2 grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_9.5rem_auto] items-center">
                    <Input aria-label={`Họ tên người liên hệ ${i + 1}`} placeholder="Họ tên" value={p.name} maxLength={80} onChange={(e) => setP(i, { name: e.target.value })} className="max-sm:col-span-2" />
                    <Input aria-label={`Vai trò của người liên hệ ${i + 1}`} placeholder="Vai trò" value={p.role} maxLength={80} onChange={(e) => setP(i, { role: e.target.value })} className="max-sm:col-span-2" />
                    <Input aria-label={`Điện thoại của người liên hệ ${i + 1}`} placeholder="Điện thoại" inputMode="tel" value={p.phone} maxLength={30} onChange={(e) => setP(i, { phone: e.target.value })} />
                    <Button variant="ghost" className="hover:text-danger px-2.5" icon={<Trash2 aria-hidden />} aria-label={`Gỡ ${p.name || `người liên hệ ${i + 1}`}`} onClick={() => setPeople((l) => l.filter((_, k) => k !== i))} />
                  </li>
                ))}
              </ul>
              {people.length < 8 && <Button className={people.length ? 'mt-3' : ''} icon={<Plus aria-hidden />} onClick={() => setPeople((l) => [...l, { name: '', role: '', phone: '' }])}>Thêm người</Button>}
            </Section>
            <Section title="Trang Liên hệ" icon={<MessageSquareText />}>
              <div className="grid gap-4">
                <Switch label="Nhận lời nhắn qua form" checked={formOn} onChange={(v) => setF({ ...f, contact_form: v ? '1' : '0' })}
                  description={formOn ? 'Người xem gửi được lời nhắn. Thư vào mục Hòm thư.' : 'Ẩn form. Trang chỉ còn thông tin liên hệ.'} />
                <Field label="Lời dẫn đầu trang" htmlFor="c-intro" optional hint="Để trống thì dùng câu mặc định."><Textarea id="c-intro" rows={3} maxLength={400} {...bind('contact_intro')} /></Field>
                <a href="/lien-he" target="_blank" rel="noreferrer" className={buttonClass('secondary', 'md', 'self-start')}><Eye aria-hidden />Xem trang Liên hệ</a>
              </div>
            </Section>
          </div>
        )}

        {tab === 'template' && (
          <Section title="Mẫu trang" icon={<LayoutTemplate />} hint="Nội dung giữ nguyên, chỉ đổi cách trình bày trang chủ.">
            <div role="radiogroup" aria-label="Mẫu trang" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TEMPLATES.map((t) => {
                const on = chosen === t.id;
                return (
                  <div key={t.id} className={cx('rounded-xl border bg-surface overflow-hidden transition-[border-color,box-shadow]', on ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-line-strong hover:shadow-md')}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setF({ ...f, template: t.id })} className="block w-full text-left cursor-pointer">
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
          </Section>
        )}

        {tab === 'display' && (
          <Section title="Đường nối trên phả đồ" icon={<SlidersHorizontal />} hint="Cách vẽ đường từ cha mẹ xuống con, áp dụng cho cả trang xem và trang quản trị.">
            <div role="radiogroup" aria-label="Đường nối trên phả đồ" className="grid gap-4 sm:grid-cols-3 max-w-3xl">
              {([['ortho', 'Góc vuông', 'Đi xuống, rẽ ngang, rồi xuống từng con.'], ['curve', 'Đường cong', 'Cong mềm từ cha mẹ tới từng con.'], ['straight', 'Đường thẳng', 'Chéo thẳng từ cha mẹ tới từng con.']] as const).map(([id, name, desc]) => {
                const on = lines === id;
                const d = (x: number) => (id === 'ortho' ? `M60,26V44H${x}V62` : id === 'curve' ? `M60,26C60,50 ${x},38 ${x},62` : `M60,26L${x},62`);
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setF({ ...f, tree_lines: id })}
                    className={cx('rounded-xl border bg-surface p-3 text-left cursor-pointer transition-[border-color,box-shadow]', on ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-line-strong hover:shadow-md')}>
                    <svg viewBox="0 0 120 84" aria-hidden className="w-full rounded-lg bg-sunken">
                      <g fill="none" stroke="#8f8e8a" strokeWidth="1.5">{[22, 60, 98].map((x) => <path key={x} d={d(x)} />)}</g>
                      <g fill="#fff" stroke="#37352f" strokeWidth="1.5">
                        <rect x="46" y="10" width="28" height="16" rx="3" />
                        {[22, 60, 98].map((x) => <rect key={x} x={x - 14} y="62" width="28" height="14" rx="3" />)}
                      </g>
                    </svg>
                    <span className="mt-3 flex items-center gap-2 font-semibold text-ink">
                      <span className={cx('size-[18px] shrink-0 rounded-full border-2 inline-flex items-center justify-center', on ? 'border-accent bg-accent text-white' : 'border-line-strong')}>{on && <Check aria-hidden className="size-3" strokeWidth={3} />}</span>
                      {name}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">{desc}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {tab === 'security' && (
          <div className="grid gap-6 xl:grid-cols-2 items-start">
            <PasscodeSection hasPasscode={data.has_passcode} onSave={save} />
            <StorageSection />
          </div>
        )}
      </div>

      {tab !== 'security' && (
        <div className="fixed bottom-0 right-0 left-0 md:left-[220px] lg:left-[240px] 2xl:left-[264px] z-20 border-t border-line bg-surface/95 backdrop-blur px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
          <p role="status" className="flex-1 min-w-0 text-sm text-ink-2 truncate">{dirty ? 'Có thay đổi chưa lưu.' : 'Thay đổi chỉ áp dụng sau khi bấm Lưu.'}</p>
          {dirty && <Button icon={<RotateCcw aria-hidden />} onClick={() => { setF(data); setPeople(parsePeople(data.contact_people)); }}><span className="max-sm:sr-only">Bỏ thay đổi</span></Button>}
          <Button variant="primary" icon={<Save aria-hidden />} loading={busy} disabled={!dirty} onClick={() => save()}>Lưu lại</Button>
        </div>
      )}
    </div>
  );
}

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
