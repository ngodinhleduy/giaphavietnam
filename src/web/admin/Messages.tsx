import { useState, useEffect } from 'react';
import { Inbox, MailOpen, Trash2, RefreshCw } from 'lucide-react';
import { api, useApi } from '../lib/api.ts';
import { Badge, Button, EmptyState, ErrorState, Loading, Modal, PageHeader, Pagination, TableCard, cx, usePageSize, useToast } from '../components/ui.tsx';
import { when } from './Admins.tsx';

type Msg = { id: number; name: string; contact: string | null; subject: string | null; body: string; is_read: number; created_at: string };

/** Hòm thư: lời nhắn người xem gửi từ trang Liên hệ. */
export function MessagesAdmin() {
  const [page, setPage] = useState(0);
  const [PER, setPER] = usePageSize('messages');
  const { data, error, loading, reload, setData } = useApi<{ rows: Msg[]; total: number }>(`/admin/messages?limit=${PER}&offset=${page * PER}`);
  const [open, setOpen] = useState<Msg | null>(null);
  const [removing, setRemoving] = useState<Msg | null>(null);
  const toast = useToast();
  // Quay lại tab này sau khi sang chỗ khác: tự tải lại để thấy thư mới
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [reload]);

  const mark = async (m: Msg, is_read: number) => {
    try {
      await api.put(`/admin/messages/${m.id}`, { is_read });
      setData((d) => d && { ...d, rows: d.rows.map((r) => (r.id === m.id ? { ...r, is_read } : r)) });
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const show = (m: Msg) => { setOpen(m); if (!m.is_read) mark(m, 1); };
  const unread = data?.rows.filter((r) => !r.is_read).length ?? 0;
  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const isPhone = (s: string) => /^[+\d][\d\s.\-]{7,}$/.test(s);

  return (
    <>
      <PageHeader title="Hòm thư" subtitle={data ? `${data.total} thư${unread ? `, ${unread} chưa đọc ở trang này` : ''}` : undefined}
        actions={<Button icon={<RefreshCw aria-hidden />} loading={loading && !!data} onClick={async () => { reload(); toast('Đã tải lại hòm thư.'); }}>Tải lại</Button>} />
      <p className="-mt-3 mb-6 text-sm text-ink-2 max-w-2xl">Lời nhắn gửi từ trang Liên hệ. Trả lời qua số điện thoại hoặc email người gửi để lại.</p>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.rows.length ? (
        <EmptyState icon={<Inbox />} title="Chưa có thư nào" text="Lời nhắn gửi từ trang Liên hệ sẽ hiện ở đây." />
      ) : (
        <TableCard footer={<Pagination page={page} size={PER} total={data.total} onPage={setPage} onSize={setPER} unit="thư" />}>
          <ul className="divide-y divide-line">
            {data.rows.map((m) => (
              <li key={m.id} className="group/row relative transition-colors hover:bg-accent-soft/60 focus-within:bg-accent-soft/60">
                <button type="button" onClick={() => show(m)} className="w-full text-left flex items-start gap-3 pl-4 sm:pl-5 pr-16 py-3 cursor-pointer">
                  <span aria-hidden className={cx('mt-2 size-2 shrink-0 rounded-full', m.is_read ? 'bg-transparent' : 'bg-brand')} />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cx('truncate', m.is_read ? 'text-ink' : 'font-semibold text-ink')}>{m.name}</span>
                      {!m.is_read && <Badge tone="brand">Chưa đọc</Badge>}
                      <span className="ml-auto text-sm text-ink-2 tabular-nums">{when(m.created_at)}</span>
                    </span>
                    <span className="block text-sm text-ink-2 truncate">{m.subject ? `${m.subject}: ` : ''}{m.body}</span>
                  </span>
                </button>
                {/* Nút xóa hiện khi rê chuột hoặc focus vào dòng; trên màn cảm ứng luôn hiện vì không có hover */}
                <button type="button" onClick={() => setRemoving(m)} aria-label={`Xóa thư của ${m.name}`} title="Xóa thư"
                  className="opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100 transition-opacity absolute right-3 top-1/2 -translate-y-1/2 size-9 pointer-coarse:size-11 inline-flex items-center justify-center rounded-lg text-ink-2 cursor-pointer hover:bg-danger-soft hover:text-danger focus-visible:bg-danger-soft focus-visible:text-danger">
                  <Trash2 aria-hidden className="size-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        </TableCard>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.subject || 'Thư từ trang Liên hệ'} width="max-w-xl"
        footer={open && <>
          <Button variant="ghost" className="text-danger mr-auto" icon={<Trash2 aria-hidden />} onClick={() => { setRemoving(open); setOpen(null); }}>Xóa</Button>
          <Button icon={<MailOpen aria-hidden />} onClick={() => { mark(open, 0); setOpen(null); }}>Chưa đọc</Button>
          <Button variant="primary" onClick={() => setOpen(null)}>Đóng</Button>
        </>}>
        {open && (
          <div className="space-y-3">
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-2">Người gửi</dt><dd className="font-medium">{open.name}</dd>
              <dt className="text-ink-2">Liên hệ</dt>
              <dd className="break-all">{!open.contact ? <span className="text-ink-2">Không để lại</span>
                : isEmail(open.contact) ? <a className="underline underline-offset-4" href={`mailto:${open.contact}`}>{open.contact}</a>
                : isPhone(open.contact) ? <a className="underline underline-offset-4" href={`tel:${open.contact.replace(/[^\d+]/g, '')}`}>{open.contact}</a>
                : open.contact}</dd>
              <dt className="text-ink-2">Gửi lúc</dt>
              <dd className="tabular-nums">{new Date(open.created_at.replace(' ', 'T') + 'Z').toLocaleString('vi-VN')}</dd>
            </dl>
            <p className="whitespace-pre-wrap break-words leading-relaxed border-t border-line pt-3">{open.body}</p>
          </div>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Xóa thư này?"
        footer={<><Button onClick={() => setRemoving(null)}>Hủy</Button><Button variant="danger" onClick={async () => {
          try { await api.del(`/admin/messages/${removing!.id}`); toast('Đã xóa thư.'); reload(); } catch (e: any) { toast(e.message, 'error'); }
          setRemoving(null);
        }}>Xóa thư</Button></>}>
        <p className="text-ink-2">Thư của <b className="text-ink">{removing?.name}</b> sẽ bị xóa vĩnh viễn.</p>
      </Modal>
    </>
  );
}
