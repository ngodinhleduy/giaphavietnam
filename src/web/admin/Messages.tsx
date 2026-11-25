import { useState } from 'react';
import { api, useApi } from '../lib/api.ts';
import { Badge, Button, EmptyState, ErrorState, Loading, Modal, PageHeader, cx, useToast } from '../components/ui.tsx';
import { when } from './Admins.tsx';

type Msg = { id: number; name: string; contact: string | null; subject: string | null; body: string; is_read: number; created_at: string };
const PER = 30;

/** Hòm thư: lời nhắn người xem gửi từ trang Liên hệ. */
export function MessagesAdmin() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, setData } = useApi<{ rows: Msg[]; total: number }>(`/admin/messages?limit=${PER}&offset=${page * PER}`);
  const [open, setOpen] = useState<Msg | null>(null);
  const [removing, setRemoving] = useState<Msg | null>(null);
  const toast = useToast();

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
      <PageHeader title="Hòm thư" subtitle={data ? `${data.total} thư${unread ? `, ${unread} chưa đọc ở trang này` : ''}` : undefined} />
      <p className="-mt-3 mb-6 text-sm text-ink-2 max-w-2xl">Lời nhắn con cháu gửi từ trang Liên hệ. Hệ thống không gửi email: bạn trả lời qua số điện thoại hoặc email người gửi để lại.</p>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.rows.length ? (
        <EmptyState title="Chưa có thư nào" text="Khi có người gửi lời nhắn từ trang Liên hệ, thư sẽ hiện ở đây." />
      ) : (
        <>
          <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
            {data.rows.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => show(m)} className="w-full text-left flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-sunken/50 cursor-pointer">
                  <span aria-hidden className={cx('mt-2 size-2 shrink-0 rounded-full', m.is_read ? 'bg-transparent' : 'bg-ink')} />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cx('truncate', m.is_read ? 'text-ink' : 'font-semibold text-ink')}>{m.name}</span>
                      {!m.is_read && <Badge>Chưa đọc</Badge>}
                      <span className="ml-auto text-sm text-ink-2 tabular-nums">{when(m.created_at)}</span>
                    </span>
                    <span className="block text-sm text-ink-2 truncate">{m.subject ? `${m.subject}: ` : ''}{m.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data.total > PER && (
            <div className="mt-4 flex items-center justify-between text-sm text-ink-2">
              <span>Trang {page + 1}/{Math.ceil(data.total / PER)}</span>
              <span className="flex gap-2">
                <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
                <Button size="sm" disabled={(page + 1) * PER >= data.total} onClick={() => setPage(page + 1)}>Sau</Button>
              </span>
            </div>
          )}
        </>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.subject || 'Thư từ trang Liên hệ'} width="max-w-xl"
        footer={open && <>
          <Button variant="ghost" className="text-danger mr-auto" onClick={() => { setRemoving(open); setOpen(null); }}>Xóa</Button>
          <Button onClick={() => { mark(open, 0); setOpen(null); }}>Đánh dấu chưa đọc</Button>
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
