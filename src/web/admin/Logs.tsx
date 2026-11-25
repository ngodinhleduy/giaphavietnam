import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '../lib/api.ts';
import { Button, EmptyState, ErrorState, Loading, PageHeader } from '../components/ui.tsx';

export type LogRow = { id: number; admin_name: string | null; action: string; created_at: string };
const PAGE = 50;

/** Giờ lưu trong database là UTC, hiển thị theo giờ máy người xem. */
export function logTime(utc: string) {
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return utc;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function LogsAdmin() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useApi<{ rows: LogRow[]; total: number }>(`/admin/logs?limit=${PAGE}&offset=${page * PAGE}`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  return (
    <>
      <PageHeader title="Nhật ký" subtitle="Ai đã thêm, sửa, xóa gì trên trang quản trị." />
      {!data.rows.length ? (
        <EmptyState icon={<History />} title="Chưa có thao tác nào" text="Mọi lần thêm, sửa, xóa sẽ hiện ở đây." />
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="text-left text-sm text-ink-2 border-b border-line">
                  <th className="px-4 h-11 font-medium whitespace-nowrap">Thời gian</th>
                  <th className="px-4 font-medium">Nội dung</th>
                  <th className="px-4 font-medium whitespace-nowrap">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-ink-2">{logTime(r.created_at)}</td>
                    <td className="px-4 py-3">{r.action}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.admin_name || 'Không rõ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-2">
            <span>{data.total} thao tác{loading ? ' · đang tải' : ''}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>Trước</Button>
              <span>Trang {page + 1}/{pages}</span>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
