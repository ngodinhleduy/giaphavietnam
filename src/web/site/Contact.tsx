import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { ArrowUpRight, CircleCheck, Lock, Mail, MapPin, MessageSquareText, Music2, PenLine, Phone, Play, Send } from 'lucide-react';
import { parsePeople } from '../../shared/site.ts';
import { initials } from '../lib/format.ts';
import { Button, Field, Input, Textarea, cx } from '../components/ui.tsx';
import { Container, useSite } from './SiteLayout.tsx';

const F0 = { name: '', contact: '', subject: '', body: '', website: '' };

/** Liên hệ: thông tin ban liên lạc và form gửi lời nhắn vào hòm thư của quản trị. */
export function ContactPage() {
  const { site } = useSite();
  const [f, setF] = useState(F0);
  const [errs, setErrs] = useState<{ name?: string; body?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errs = {};
    if (f.name.trim().length < 2) er.name = 'Nhập họ tên của bạn.';
    if (f.body.trim().length < 10) er.body = 'Nội dung cần ít nhất 10 ký tự.';
    setErrs(er);
    if (er.name || er.body) {
      document.getElementById(er.name ? 'ct-name' : 'ct-body')?.focus();
      return;
    }
    setBusy(true);
    try {
      await api.post('/messages', f);
      setSent(true);
      setF(F0);
    } catch (err: any) {
      setErrs({ form: err.message ?? 'Không gửi được. Thử lại sau.' });
    } finally {
      setBusy(false);
    }
  };

  const people = parsePeople(site.contact_people);
  const formOn = site.contact_form !== '0';
  const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, '')}`;
  const hasInfo = people.length > 0 || site.contact_phone || site.contact_email || site.contact_zalo || site.contact_facebook || site.contact_youtube || site.contact_tiktok || site.address;
  const chan = 'group flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 min-h-12 py-2 font-medium text-ink transition-colors hover:border-ink hover:bg-sunken';

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink">Liên hệ</h1>
      <p className="mt-3 text-ink-2 max-w-2xl leading-relaxed whitespace-pre-line">
        {site.contact_intro || (formOn ? 'Bổ sung thông tin cho phả đồ, báo chỗ sai, hoặc hỏi về việc họ: gửi lời nhắn cho ban liên lạc ở đây.' : 'Thông tin liên hệ của ban liên lạc dòng họ.')}
      </p>
      <div className={cx('mt-8 grid gap-10 items-start', formOn && 'lg:grid-cols-[minmax(0,1fr)_22rem]')}>
        {formOn && (sent ? (
          <div role="status" className="gp-rise rounded-xl border border-line bg-surface p-6 sm:p-8">
            <span aria-hidden className="size-12 inline-flex items-center justify-center rounded-full bg-success-soft text-success"><CircleCheck className="size-6" /></span>
            <h2 className="mt-4 font-semibold text-lg text-ink">Đã gửi lời nhắn</h2>
            <p className="mt-2 text-ink-2 leading-relaxed">Ban liên lạc sẽ phản hồi qua số điện thoại hoặc email bạn để lại.</p>
            <Button className="mt-5" icon={<PenLine aria-hidden />} onClick={() => setSent(false)}>Gửi thư khác</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-surface p-5 sm:p-8 space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-lg text-ink"><MessageSquareText aria-hidden className="size-5 text-ink-2" />Gửi lời nhắn</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ tên" htmlFor="ct-name" required error={errs.name}>
                <Input id="ct-name" autoComplete="name" maxLength={80} value={f.name} aria-invalid={!!errs.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })} />
              </Field>
              <Field label="Điện thoại hoặc email" htmlFor="ct-contact" optional hint="Để ban liên lạc trả lời bạn.">
                <Input id="ct-contact" maxLength={120} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
              </Field>
            </div>
            <Field label="Tiêu đề" htmlFor="ct-subject" optional>
              <Input id="ct-subject" maxLength={120} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
            </Field>
            <Field label="Nội dung" htmlFor="ct-body" required error={errs.body} aside={`${f.body.length}/3000`}>
              <Textarea id="ct-body" rows={7} maxLength={3000} value={f.body} aria-invalid={!!errs.body}
                onChange={(e) => setF({ ...f, body: e.target.value })} />
            </Field>
            {/* Ô bẫy cho máy tự động điền. Người dùng thật không thấy và không điền. */}
            <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
            </div>
            {errs.form && <p role="alert" className="text-sm text-danger">{errs.form}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button type="submit" variant="primary" icon={<Send aria-hidden />} loading={busy}>Gửi lời nhắn</Button>
              <p className="inline-flex items-center gap-1.5 text-sm text-ink-2"><Lock aria-hidden className="size-3.5 shrink-0" /><span>Chỉ ban quản trị đọc được. <Link to="/chinh-sach-bao-mat" className="underline underline-offset-4">Chính sách bảo mật</Link></span></p>
            </div>
          </form>
        ))}

        <aside className={cx('text-[15px]', formOn ? 'space-y-6' : 'grid gap-8 sm:grid-cols-2 lg:grid-cols-3')}>
          {!hasInfo && !site.contact && <p className="text-ink-2">Chưa có thông tin liên hệ.</p>}
          {people.length > 0 && (
            <section>
              <h2 className="font-semibold text-ink">Ban liên lạc</h2>
              <ul className="mt-3 space-y-3">
                {people.map((p) => (
                  <li key={p.name + p.phone} className="flex items-center gap-3">
                    <span aria-hidden className="size-10 shrink-0 rounded-full bg-sunken inline-flex items-center justify-center font-serif font-semibold text-ink-2">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block font-medium text-ink">{p.name}</span>
                      {p.role && <span className="block text-sm text-ink-2">{p.role}</span>}
                    </span>
                    {p.phone && (
                      <a href={tel(p.phone)} aria-label={`Gọi ${p.name}, ${p.phone}`} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-lg border border-line-strong text-sm font-medium tabular-nums text-ink whitespace-nowrap transition-colors hover:bg-sunken hover:border-ink">
                        <Phone aria-hidden className="size-4" />{p.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(site.contact_phone || site.contact_email || site.contact_zalo || site.contact_facebook || site.contact_youtube || site.contact_tiktok) && (
            <section>
              <h2 className="font-semibold text-ink">Kênh liên hệ</h2>
              <div className="mt-3 grid gap-2">
                {site.contact_phone && <a href={tel(site.contact_phone)} className={chan}><Phone aria-hidden className="size-5 text-ink-2 shrink-0" /><span className="flex-1 tabular-nums">{site.contact_phone}</span></a>}
                {site.contact_email && <a href={`mailto:${site.contact_email}`} className={chan}><Mail aria-hidden className="size-5 text-ink-2 shrink-0" /><span className="flex-1 min-w-0 break-all">{site.contact_email}</span></a>}
                {site.contact_zalo && <a href={site.contact_zalo} target="_blank" rel="noopener noreferrer" className={chan}><img src="/social/zalo.svg" alt="" className="size-6 shrink-0" /><span className="flex-1">Nhóm Zalo của họ</span><ArrowUpRight aria-hidden className="size-4 text-ink-2" /><span className="sr-only">(mở trang khác)</span></a>}
                {site.contact_facebook && <a href={site.contact_facebook} target="_blank" rel="noopener noreferrer" className={chan}><img src="/social/facebook.svg" alt="" className="size-6 shrink-0" /><span className="flex-1">Facebook</span><ArrowUpRight aria-hidden className="size-4 text-ink-2" /><span className="sr-only">(mở trang khác)</span></a>}
                {site.contact_youtube && <a href={site.contact_youtube} target="_blank" rel="noopener noreferrer" className={chan}><Play aria-hidden className="size-5 text-ink-2 shrink-0" /><span className="flex-1">YouTube</span><ArrowUpRight aria-hidden className="size-4 text-ink-2" /><span className="sr-only">(mở trang khác)</span></a>}
                {site.contact_tiktok && <a href={site.contact_tiktok} target="_blank" rel="noopener noreferrer" className={chan}><Music2 aria-hidden className="size-5 text-ink-2 shrink-0" /><span className="flex-1">TikTok</span><ArrowUpRight aria-hidden className="size-4 text-ink-2" /><span className="sr-only">(mở trang khác)</span></a>}
              </div>
            </section>
          )}
          {(site.address || site.contact) && (
            <section>
              <h2 className="font-semibold text-ink">Nhà thờ họ</h2>
              {site.address && <p className="mt-3 flex gap-2 text-ink-2 leading-relaxed"><MapPin aria-hidden className="size-4 shrink-0 mt-1" />{site.address}</p>}
              {site.contact && <p className="mt-2 text-ink-2 whitespace-pre-line leading-relaxed">{site.contact}</p>}
            </section>
          )}
        </aside>
      </div>
      {site.map_embed && (
        <iframe title="Bản đồ nhà thờ họ" className="mt-10 w-full h-80 rounded-xl border border-line" loading="lazy"
          src={site.map_embed.startsWith('http') ? site.map_embed : `https://www.google.com/maps?q=${encodeURIComponent(site.map_embed)}&output=embed`} />
      )}
    </Container>
  );
}
