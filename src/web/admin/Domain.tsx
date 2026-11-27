import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, Clock, Copy, ExternalLink, Globe, KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api, useApi } from '../lib/api.ts';
import { Badge, Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Spinner, cx, useToast } from '../components/ui.tsx';
import { Section } from './Members.tsx';

type Stage = 'none' | 'nameservers' | 'attaching' | 'active';
type DomainData = {
  supported: boolean; ready: boolean; host: string; stage: Stage; domain: string | null;
  nameServers?: string[]; oldNameServers?: string[]; hostnames?: { hostname: string; attached: boolean }[];
};

/** Một bước trong tiến trình. state: xong, đang làm, chưa tới. */
function Step({ n, title, state, children }: { n: number; title: string; state: 'done' | 'now' | 'todo'; children?: ReactNode }) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <span aria-hidden className="absolute left-[17px] top-9 bottom-0 w-px bg-line [li:last-child>&]:hidden" />
      <span aria-hidden className={cx('relative z-10 size-9 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-semibold',
        state === 'done' ? 'bg-accent text-white' : state === 'now' ? 'bg-surface text-ink ring-2 ring-accent' : 'bg-sunken text-ink-2')}>
        {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-1.5">
        <h3 className={cx('font-semibold', state === 'todo' ? 'text-ink-2' : 'text-ink')}>
          {title}
          <span className="sr-only">{state === 'done' ? ' (đã xong)' : state === 'now' ? ' (bước hiện tại)' : ' (chưa tới)'}</span>
        </h3>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </li>
  );
}

function CopyRow({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface pl-3 pr-1 h-11">
      <code className="flex-1 min-w-0 truncate font-mono text-[15px] text-ink">{value}</code>
      <Button size="sm" variant="ghost" icon={done ? <Check aria-hidden /> : <Copy aria-hidden />} aria-label={`Sao chép ${label} ${value}`}
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* trình duyệt chặn: người dùng tự chọn và chép */ } }}>
        {done ? 'Đã chép' : 'Chép'}
      </Button>
    </div>
  );
}

export function DomainAdmin() {
  const { data, error, loading, reload, setData } = useApi<DomainData>('/admin/domain');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'add' | 'check' | 'remove'>('');
  const [removing, setRemoving] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [live, setLive] = useState<Record<string, 'ok' | 'wait'>>({});
  const toast = useToast();

  const check = async (quiet = false) => {
    setBusy('check');
    try {
      const d = await api.post<DomainData>('/admin/domain/check');
      setData(d);
      setCheckedAt(new Date());
      if (!quiet) toast(d.stage === 'nameservers' ? 'Cloudflare chưa thấy nameserver mới. Thường mất từ vài phút đến vài giờ.' : d.stage === 'active' ? 'Tên miền đã được gắn.' : 'Đang gắn tên miền.');
    } catch (e: any) { if (!quiet) toast(e.message, 'error'); } finally { setBusy(''); }
  };

  // Đang chờ nameserver hoặc đang gắn: tự kiểm tra lại mỗi phút khi trang còn mở
  const stage = data?.stage;
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    if (stage !== 'nameservers' && stage !== 'attaching') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') checkRef.current(true); }, 60_000);
    return () => clearInterval(t);
  }, [stage]);

  // Đã gắn: thử gọi thẳng tên miền từ trình duyệt để biết HTTPS đã chạy chưa (chứng chỉ cần vài phút)
  const hostKey = (data?.hostnames ?? []).filter((h) => h.attached).map((h) => h.hostname).join(',');
  useEffect(() => {
    if (!hostKey) return;
    let stop = false;
    const probe = async () => {
      for (const h of hostKey.split(',')) {
        try { await fetch(`https://${h}/api/site`, { mode: 'no-cors', cache: 'no-store' }); if (!stop) setLive((l) => ({ ...l, [h]: 'ok' })); }
        catch { if (!stop) setLive((l) => ({ ...l, [h]: 'wait' })); }
      }
    };
    probe();
    const t = setInterval(probe, 30_000);
    return () => { stop = true; clearInterval(t); };
  }, [hostKey]);

  if (loading && !data) return <Loading />;
  if (error || !data) return (
    <div className="mx-auto w-full max-w-[72rem]">
      <PageHeader title="Tên miền" />
      <ErrorState error={error ?? 'Lỗi'} onRetry={reload} />
    </div>
  );

  const add = async () => {
    const v = name.trim();
    if (!v) return setErr('Nhập tên miền bạn đã mua.');
    setBusy('add'); setErr('');
    try { setData(await api.post<DomainData>('/admin/domain', { domain: v })); setName(''); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('remove');
    try { await api.del('/admin/domain'); toast('Đã gỡ tên miền.'); setRemoving(false); setLive({}); reload(); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(''); }
  };
  const s = data.stage;
  const st = (i: number): 'done' | 'now' | 'todo' => {
    const cur = s === 'none' ? 1 : s === 'nameservers' ? 2 : s === 'attaching' ? 3 : 4;
    return i < cur ? 'done' : i === cur ? 'now' : 'todo';
  };

  return (
    <div className="mx-auto w-full max-w-[72rem]">
      <PageHeader title="Tên miền" subtitle="Gắn tên miền riêng bạn đã mua vào trang gia phả." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <div className="grid gap-6 min-w-0">
          <Section title="Địa chỉ hiện tại" icon={<Globe />}>
            <ul className="grid gap-2">
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <a href={`https://${data.host}`} target="_blank" rel="noreferrer" className="font-mono text-[15px] text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink break-all">{data.host}</a>
                <Badge tone="success">Đang chạy</Badge>
                {s !== 'active' && <span className="text-sm text-ink-2">Địa chỉ mặc định, luôn dùng được.</span>}
              </li>
              {(data.hostnames ?? []).filter((h) => h.attached).map((h) => (
                <li key={h.hostname} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a href={`https://${h.hostname}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[15px] text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink break-all">{h.hostname}<ExternalLink aria-hidden className="size-3.5" /></a>
                  {live[h.hostname] === 'ok' ? <Badge tone="success"><ShieldCheck aria-hidden />Đang chạy</Badge> : <Badge><Clock aria-hidden />Đang cấp chứng chỉ HTTPS</Badge>}
                </li>
              ))}
            </ul>
          </Section>

          {!data.supported ? (
            <Section title="Bản cài này không gắn tên miền từ đây được" icon={<CircleAlert />}>
              <p className="text-ink-2 max-w-prose">Trang này dành cho bản chạy trên Cloudflare. Với bản chạy trên NAS hoặc máy chủ riêng, tên miền được trỏ ở bộ định tuyến hoặc reverse proxy của máy đó.</p>
            </Section>
          ) : !data.ready ? (
            <TokenGuide onRetry={reload} />
          ) : (
            <Section title={s === 'active' ? `${data.domain} đã được gắn` : 'Gắn tên miền riêng'} icon={<Globe />}>
              <ol>
                <Step n={1} title="Nhập tên miền" state={st(1)}>
                  {s === 'none' ? (
                    <form onSubmit={(e) => { e.preventDefault(); add(); }} className="max-w-lg">
                      <Field label="Tên miền đã mua" htmlFor="dm" error={err || undefined} hint="Nhập tên miền gốc, ví dụ hongo.vn. Địa chỉ www cũng được gắn kèm.">
                        <div className="flex flex-wrap gap-2">
                          <Input id="dm" value={name} onChange={(e) => { setName(e.target.value); if (err) setErr(''); }} placeholder="hongo.vn" inputMode="url"
                            autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={!!err} className="flex-1 min-w-[12rem] font-mono" />
                          <Button type="submit" variant="primary" loading={busy === 'add'}>Thêm tên miền</Button>
                        </div>
                      </Field>
                    </form>
                  ) : <p className="font-mono text-[15px] text-ink break-all">{data.domain}</p>}
                </Step>

                <Step n={2} title="Đổi nameserver ở nơi bạn mua tên miền" state={st(2)}>
                  {s === 'nameservers' && (
                    <div className="grid gap-4 max-w-lg">
                      <p className="text-ink-2">Vào trang quản lý tên miền của nhà cung cấp, tìm mục Nameserver (hoặc DNS, Máy chủ tên miền), xóa các dòng cũ rồi nhập hai dòng sau:</p>
                      <div className="grid gap-2">{(data.nameServers ?? []).map((ns, i) => <CopyRow key={ns} value={ns} label={`nameserver ${i + 1}`} />)}</div>
                      {!!data.oldNameServers?.length && (
                        <p className="text-sm text-ink-2">Nameserver hiện tại, cần thay đi: <span className="font-mono text-ink break-all">{data.oldNameServers.join(', ')}</span></p>
                      )}
                      <p className="flex gap-2 rounded-lg bg-sunken px-3 py-2.5 text-sm text-ink">
                        <CircleAlert aria-hidden className="size-4 shrink-0 mt-0.5" />
                        <span>Nếu tên miền đang dùng cho email (ví dụ ten@{data.domain}) hoặc một trang khác, các bản ghi đó phải được khai lại bên Cloudflare, nếu không sẽ ngừng chạy sau khi đổi.</span>
                      </p>
                    </div>
                  )}
                </Step>

                <Step n={3} title="Chờ Cloudflare xác nhận" state={st(3)}>
                  {(s === 'nameservers' || s === 'attaching') && (
                    <div className="grid gap-3 max-w-lg">
                      <p className="text-ink-2">{s === 'nameservers'
                        ? 'Sau khi đổi nameserver, thường mất từ vài phút đến vài giờ, có nơi tới 24 giờ. Trang này tự kiểm tra mỗi phút khi còn mở.'
                        : 'Nameserver đã đúng. Đang gắn tên miền vào trang.'}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button variant="primary" icon={<RefreshCw aria-hidden />} loading={busy === 'check'} onClick={() => check()}>Kiểm tra ngay</Button>
                        <p role="status" className="text-sm text-ink-2 tabular-nums">
                          {busy === 'check' ? 'Đang kiểm tra...' : checkedAt ? `Kiểm tra lần cuối lúc ${checkedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </Step>

                <Step n={4} title="Tên miền hoạt động" state={s === 'active' ? 'done' : 'todo'}>
                  {s === 'active' && (
                    <div className="grid gap-3 max-w-lg">
                      <p className="text-ink-2">Chứng chỉ HTTPS được cấp tự động, thường xong trong 5 đến 15 phút. Địa chỉ mặc định vẫn dùng song song.</p>
                      {Object.values(live).some((v) => v === 'wait') && <p className="inline-flex items-center gap-2 text-sm text-ink-2"><Spinner className="size-4" />Đang chờ chứng chỉ, tự kiểm tra lại mỗi 30 giây.</p>}
                    </div>
                  )}
                </Step>
              </ol>

              {s !== 'none' && (
                <div className="mt-6 pt-4 border-t border-line">
                  <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={() => setRemoving(true)}>Gỡ tên miền</Button>
                </div>
              )}
            </Section>
          )}
        </div>

        <aside className="grid gap-6">
          <Section title="Cần biết trước" icon={<CircleAlert />}>
            <ul className="grid gap-3 text-sm text-ink-2 leading-relaxed">
              <li><b className="font-medium text-ink">Tên miền vẫn là của bạn.</b> Bạn tiếp tục gia hạn ở nơi đã mua. Chỉ phần DNS chuyển sang Cloudflare, miễn phí.</li>
              <li><b className="font-medium text-ink">Trang cũ sẽ ngừng hiện ở tên miền đó.</b> Nếu tên miền đang trỏ về một dịch vụ gia phả khác, hãy chuyển xong dữ liệu trước.</li>
              <li><b className="font-medium text-ink">Một tên miền mỗi lần.</b> Muốn đổi sang tên miền khác thì gỡ tên miền hiện tại trước.</li>
            </ul>
          </Section>
        </aside>
      </div>

      <Modal open={removing} onClose={() => setRemoving(false)} title="Gỡ tên miền?"
        footer={<><Button onClick={() => setRemoving(false)}>Hủy</Button><Button variant="danger" icon={<Trash2 aria-hidden />} loading={busy === 'remove'} onClick={remove}>Gỡ tên miền</Button></>}>
        <p className="text-ink-2"><b className="text-ink font-mono break-all">{data.domain}</b> sẽ không còn mở ra trang gia phả. Địa chỉ mặc định <span className="font-mono break-all">{data.host}</span> vẫn chạy. Vùng DNS trên Cloudflare được giữ nguyên, bạn gắn lại lúc nào cũng được.</p>
      </Modal>
    </div>
  );
}

/** Chưa khai API token: hướng dẫn chủ trang tự tạo và tự dán, vì đây là khóa vào tài khoản Cloudflare của họ. */
function TokenGuide({ onRetry }: { onRetry: () => void }) {
  const steps: [string, ReactNode][] = [
    ['Tạo token', <>Vào Cloudflare, chọn My Profile, API Tokens, Create Token, Create Custom Token.</>],
    ['Cấp quyền', <>Thêm ba quyền: <b className="font-medium text-ink">Account, Workers Scripts, Edit</b>; <b className="font-medium text-ink">Zone, Zone, Edit</b>; <b className="font-medium text-ink">Zone, DNS, Edit</b>. Ở Account Resources chọn tài khoản của bạn, ở Zone Resources chọn All zones from an account.</>],
    ['Dán vào Worker', <>Vào Workers &amp; Pages, mở Worker của trang, Settings, Variables and Secrets, Add. Loại <b className="font-medium text-ink">Secret</b>, tên <code className="font-mono text-ink">CF_API_TOKEN</code>, giá trị là token vừa tạo, rồi Deploy.</>],
  ];
  return (
    <Section title="Cần một API token của Cloudflare" icon={<KeyRound />}
      hint="Trang quản trị dùng token này để tạo vùng DNS và gắn tên miền thay bạn. Token chỉ lưu ở Cloudflare, không hiện lại ở đây.">
      <ol className="grid gap-4 max-w-prose">
        {steps.map(([t, body], i) => (
          <li key={t} className="flex gap-3">
            <span aria-hidden className="size-7 shrink-0 rounded-full bg-sunken text-sm font-semibold text-ink inline-flex items-center justify-center">{i + 1}</span>
            <p className="text-ink-2 leading-relaxed"><b className="font-semibold text-ink">{t}.</b> {body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer" className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface font-medium text-ink transition-colors hover:bg-sunken hover:border-ink">
          <ExternalLink aria-hidden className="size-[18px]" />Mở trang API Tokens
        </a>
        <Button icon={<RefreshCw aria-hidden />} onClick={onRetry}>Tôi đã dán token, kiểm tra lại</Button>
      </div>
    </Section>
  );
}
