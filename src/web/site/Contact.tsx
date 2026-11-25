import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { Button, Field, Input, Textarea } from '../components/ui.tsx';
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

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink">Liên hệ</h1>
      <p className="mt-3 text-ink-2 max-w-2xl leading-relaxed">Bổ sung thông tin cho phả đồ, báo chỗ sai, hoặc hỏi về việc họ: gửi lời nhắn cho ban liên lạc ở đây.</p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        {sent ? (
          <div role="status" className="rounded-xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-semibold text-lg text-ink">Đã gửi lời nhắn</h2>
            <p className="mt-2 text-ink-2 leading-relaxed">Ban liên lạc sẽ đọc và phản hồi qua thông tin bạn để lại. Nếu bạn không để lại số điện thoại hoặc email, ban liên lạc không có cách nào trả lời.</p>
            <Button className="mt-5" onClick={() => setSent(false)}>Gửi thư khác</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-surface p-5 sm:p-8 space-y-4">
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
              <Button type="submit" variant="primary" loading={busy}>Gửi lời nhắn</Button>
              <p className="text-sm text-ink-2">Thông tin chỉ ban quản trị đọc được. Xem <Link to="/chinh-sach-bao-mat" className="underline underline-offset-4">chính sách bảo mật</Link>.</p>
            </div>
          </form>
        )}
        <aside className="space-y-5 text-[15px]">
          <div>
            <h2 className="font-semibold text-ink">Ban liên lạc</h2>
            <p className="mt-2 text-ink-2 whitespace-pre-line leading-relaxed">{site.contact || 'Chưa có thông tin liên hệ.'}</p>
          </div>
          {site.address && (
            <div>
              <h2 className="font-semibold text-ink">Nhà thờ họ</h2>
              <p className="mt-2 text-ink-2 leading-relaxed">{site.address}</p>
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}
