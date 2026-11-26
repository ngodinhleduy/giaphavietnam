import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '../lib/api.ts';
import { EmptyState, ErrorState, Loading, PageHeader, Pagination, TableCard, cx, usePageSize } from '../components/ui.tsx';

export type LogRow = { id: number; admin_name: string | null; action: string; created_at: string };

/** Giờ lưu trong database là UTC, hiển thị theo giờ máy người xem. */
export function logTime(utc: string) {
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return utc;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function LogsAdmin() {
  const [page, setPage] = useState(0);
  const [PAGE, setPAGE] = usePageSize('logs');
  const { data, error, loading, reload } = useApi<{ rows: LogRow[]; total: number }>(`/admin/logs?limit=${PAGE}&offset=${page * PAGE}`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Nhật ký" subtitle="Ai đã thêm, sửa, xóa gì trên trang quản trị." />
      {!data.rows.length ? (
        <EmptyState icon={<History />} title="Chưa có thao tác nào" text="Mọi lần thêm, sửa, xóa sẽ hiện ở đây." />
      ) : (
        <TableCard footer={<Pagination page={page} size={PAGE} total={data.total} onPage={setPage} onSize={setPAGE} unit="thao tác" />}>
            <table className={cx('gp-table w-full text-[15px] transition-opacity', loading && 'opacity-50')}>
              <thead>
                <tr className="text-left text-sm text-ink-2">
                  <th className="px-4 h-11 font-medium whitespace-nowrap">Thời gian</th>
                  <th className="px-4 font-medium">Nội dung</th>
                  <th className="px-4 font-medium whitespace-nowrap">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-accent-soft/60">
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-ink-2">{logTime(r.created_at)}</td>
                    <td className="px-4 py-3">{r.action}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.admin_name || 'Không rõ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableCard>
      )}
    </>
  );
}
