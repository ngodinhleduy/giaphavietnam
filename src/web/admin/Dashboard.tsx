import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronRight, CircleCheck, ExternalLink, FileText, History, Images, Inbox, Layers, Lock, Network, PenLine, Settings, TriangleAlert, UserPlus, Users, FileSpreadsheet, ZoomIn, ZoomOut } from 'lucide-react';
import { useApi } from '../lib/api.ts';
import type { Marriage, MemberBrief, Site, UpcomingEvent } from '../lib/types.ts';
import { LUNAR_MONTHS } from '../components/DateInput.tsx';
import { solarToLunar, canChiYear } from '../../shared/lunar.ts';
import { daysUntil, initials } from '../lib/format.ts';
import { ErrorState, LinkButton, Loading, Skeleton, cx } from '../components/ui.tsx';
import { FamilyTree, useTreeModel, type FamilyTreeHandle, type TreeOptions } from '../components/FamilyTree.tsx';
import { logTime, type LogRow } from './Logs.tsx';
import { useMe } from './AdminLayout.tsx';

type Stats = {
  members: number; living: number; deceased: number; generations: number; articles: number; events: number;
  albums: number; photos: number; storage: string; unread: number; pending: number; orphans: { id: number; full_name: string; generation: number }[];
};
type TreeData = { members: MemberBrief[]; marriages: Marriage[] };

const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Thẻ khung chung của Tổng quan: tiêu đề có icon, phần phụ bên phải. */
function Card({ title, icon, aside, children, className }: { title: string; icon: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('gp-surface rounded-xl border border-line bg-surface flex flex-col min-w-0', className)}>
      <h2 className="flex items-center gap-2.5 px-4 sm:px-5 min-h-14 py-2 border-b border-line font-semibold text-ink">
        <span aria-hidden className="text-accent [&_svg]:size-[18px]">{icon}</span>
        <span className="flex-1 min-w-0 truncate">{title}</span>
        {aside}
      </h2>
      {children}
    </section>
  );
}
const moreLink = 'inline-flex items-center gap-1 min-h-9 text-sm font-medium text-ink-2 hover:text-ink transition-colors';

export function Dashboard() {
  const me = useMe();
  const isAdmin = me?.role === 'admin';
  const { data: s, error, loading, reload } = useApi<Stats>('/admin/stats');
  const tree = useApi<TreeData>('/tree');
  const ev = useApi<UpcomingEvent[]>('/events/upcoming?days=30');
  const site = useApi<Site>('/site');
  const logs = useApi<{ rows: LogRow[]; total: number }>(isAdmin ? '/admin/logs?limit=6' : null);
  if (loading) return <Loading />;
  if (error || !s) return <ErrorState error={error ?? 'Lỗi'} onRetry={reload} />;

  const now = new Date();
  const lunar = solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
  const livingPct = s.members ? Math.round((s.living / s.members) * 100) : 0;

  const kpis = [
    { to: '/admin/members', icon: <Users />, tone: 'bg-accent-soft text-accent', label: 'Thành viên', value: s.members,
      sub: <>
        <span className="mt-2.5 block h-1.5 rounded-full bg-line overflow-hidden" role="img" aria-label={`${s.living} còn sống, ${s.deceased} đã mất`}>
          <span className="block h-full bg-accent rounded-full" style={{ width: `${livingPct}%` }} />
        </span>
        <span className="mt-1.5 flex flex-wrap justify-between gap-x-2 text-[13px] sm:text-sm text-ink-2 whitespace-nowrap"><span>{s.living} còn sống</span><span>{s.deceased} đã mất</span></span>
      </> },
    { to: '/admin/tree', icon: <Layers />, tone: 'bg-brand-soft text-brand', label: 'Số đời', value: s.generations || 0, sub: <span className="mt-1.5 block text-sm text-ink-2">Tính từ thủy tổ</span> },
    { to: '/admin/articles', icon: <FileText />, tone: 'bg-success-soft text-success', label: 'Bài viết', value: s.articles,
      sub: <span className="mt-1.5 block text-sm text-ink-2">{s.pending > 0 ? `${s.pending} chờ duyệt` : 'Phả ký, tin tức'}</span> },
    { to: '/admin/albums', icon: <Images />, tone: 'bg-warning-soft text-warning', label: 'Ảnh', value: s.photos, sub: <span className="mt-1.5 block text-sm text-ink-2">{s.albums} album</span> },
  ];

  // Việc đang chờ người quản lý xử lý
  const todo = [
    s.pending > 0 && { to: '/admin/articles', icon: <FileText />, text: `${s.pending} bài viết chờ duyệt` },
    isAdmin && s.unread > 0 && { to: '/admin/messages', icon: <Inbox />, text: `${s.unread} thư chưa đọc` },
    s.orphans.length > 0 && { to: `/admin/members/${s.orphans[0].id}`, icon: <Network />,
      text: s.orphans.length === 1 ? `${s.orphans[0].full_name} chưa gắn cha mẹ` : `${s.orphans.length} người chưa gắn cha mẹ`, note: 'Đang hiện như một gốc riêng trên cây' },
    isAdmin && site.data && !site.data.locked && { to: '/admin/settings?tab=security', icon: <Lock />, text: 'Phả đồ chưa đặt mã xem', note: 'Ai có link cũng xem được' },
    isAdmin && s.storage === 'none' && { to: '/admin/settings?tab=security', icon: <TriangleAlert />, text: 'Chưa cấu hình nơi lưu ảnh' },
  ].filter(Boolean) as { to: string; icon: ReactNode; text: string; note?: string }[];

  const shortcuts = [
    { to: '/admin/members/new', icon: <UserPlus />, label: 'Thêm thành viên' },
    { to: '/admin/members', icon: <FileSpreadsheet />, label: 'Quản lý thành viên' },
    { to: '/admin/articles/new', icon: <PenLine />, label: 'Viết bài' },
    { to: '/admin/events', icon: <CalendarDays />, label: 'Sự kiện, ngày giỗ' },
    ...(isAdmin ? [{ to: '/admin/settings', icon: <Settings />, label: 'Cấu hình website' }] : []),
  ];

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">
            {WEEKDAY[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1}/{now.getFullYear()}
            <span className="mx-2 text-line-strong" aria-hidden>·</span>
            {lunar.day < 11 ? `Mùng ${lunar.day}` : lunar.day} tháng {LUNAR_MONTHS[lunar.month - 1]}{lunar.leap ? ' nhuận' : ''} năm {canChiYear(lunar.year)}
          </p>
          <h1 className="mt-1 font-serif text-2xl sm:text-[28px] font-semibold text-ink leading-tight">Chào {me?.display_name || 'bạn'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton to="/" target="_blank" icon={<ExternalLink aria-hidden />}>Xem website</LinkButton>
          <LinkButton to="/admin/members/new" variant="primary" icon={<UserPlus aria-hidden />}>Thêm thành viên</LinkButton>
        </div>
      </header>

      <ul className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label}>
            <Link to={k.to} className="gp-card gp-surface group block h-full rounded-xl border border-line bg-surface p-4 sm:p-5">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-2">{k.label}</span>
                <span aria-hidden className={cx('size-10 inline-flex items-center justify-center rounded-lg [&_svg]:size-5', k.tone)}>{k.icon}</span>
              </span>
              <span className="block mt-1 font-serif text-[2rem] sm:text-4xl leading-none font-medium tabular-nums text-ink">{k.value}</span>
              {k.sub}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem] items-start">
        <div className="grid gap-4 sm:gap-6 min-w-0">
          <TreePreview tree={tree.data ?? undefined} lines={site.data?.tree_lines} />
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <GenerationChart members={tree.data?.members ?? undefined} />
            {isAdmin && (
              <Card title="Hoạt động gần đây" icon={<History />} aside={<Link to="/admin/logs" className={moreLink}>Nhật ký<ChevronRight aria-hidden className="size-4 gp-arrow" /></Link>}>
                {!logs.data ? <div className="p-5"><Skeleton className="h-24" /></div> : !logs.data.rows.length ? (
                  <p className="p-5 text-ink-2">Chưa có thao tác nào.</p>
                ) : (
                  <ol className="px-4 sm:px-5 py-2">
                    {logs.data.rows.map((r, i) => (
                      <li key={r.id} className="relative flex gap-3 py-2.5">
                        {i < logs.data!.rows.length - 1 && <span aria-hidden className="absolute left-[15px] top-[42px] bottom-[-10px] w-px bg-line" />}
                        <span aria-hidden className="relative size-8 shrink-0 inline-flex items-center justify-center rounded-full bg-sunken text-xs font-semibold text-ink-2">{initials(r.admin_name || '?')}</span>
                        <span className="min-w-0">
                          <span className="block text-[15px] text-ink leading-snug break-words">{r.action}</span>
                          <span className="block text-sm text-ink-2 tabular-nums">{r.admin_name ? `${r.admin_name} · ` : ''}{logTime(r.created_at)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-1 min-w-0 max-xl:order-first">
          <Card title="Cần xử lý" icon={todo.length ? <TriangleAlert /> : <CircleCheck />}
            aside={todo.length > 0 && <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-brand text-white text-xs font-semibold tabular-nums">{todo.length}</span>}>
            {!todo.length ? <p className="p-5 text-ink-2">Không có việc nào đang chờ.</p> : (
              <ul className="p-2">
                {todo.map((t) => (
                  <li key={t.text}>
                    <Link to={t.to} className="group flex items-center gap-3 rounded-lg px-2 sm:px-3 py-2.5 hover:bg-sunken transition-colors">
                      <span aria-hidden className="size-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-sunken text-ink group-hover:bg-surface [&_svg]:size-[18px]">{t.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-ink">{t.text}</span>
                        {t.note && <span className="block text-sm text-ink-2">{t.note}</span>}
                      </span>
                      <ArrowRight aria-hidden className="gp-arrow size-4 shrink-0 text-ink-2" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Lối tắt" icon={<ArrowRight />}>
            <nav aria-label="Lối tắt" className="p-2 grid">
              {shortcuts.map((x) => (
                <Link key={x.to} to={x.to} className="group flex items-center gap-3 rounded-lg px-2 sm:px-3 h-11 font-medium text-ink hover:bg-sunken transition-colors">
                  <span aria-hidden className="text-ink-2 group-hover:text-ink transition-colors [&_svg]:size-[18px]">{x.icon}</span>
                  <span className="flex-1 truncate">{x.label}</span>
                  <ChevronRight aria-hidden className="gp-arrow size-4 text-line-strong group-hover:text-ink" />
                </Link>
              ))}
            </nav>
          </Card>

          <Card title="30 ngày tới" icon={<CalendarDays />} className="sm:col-span-2 xl:col-span-1"
            aside={<Link to="/admin/events" className={moreLink}>Sự kiện<ChevronRight aria-hidden className="size-4 gp-arrow" /></Link>}>
            {ev.loading ? <div className="p-5"><Skeleton className="h-20" /></div> : !ev.data?.length ? (
              <p className="p-5 text-ink-2">Không có sự kiện hay ngày giỗ.</p>
            ) : (
              <ul className="divide-y divide-line">
                {ev.data.slice(0, 6).map((e) => {
                  const [, m, d] = e.next_date.split('-').map(Number);
                  const left = daysUntil(e.next_date);
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <span aria-hidden className="w-11 shrink-0 rounded-lg bg-sunken py-1.5 text-center">
                        <span className="block text-[11px] leading-none text-ink-2">Th {m}</span>
                        <span className="block mt-1 font-serif text-lg font-semibold leading-none">{d}</span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-ink truncate">{e.title}</span>
                        <span className="block text-sm text-ink-2">{e.kind === 'gio' ? 'Ngày giỗ' : 'Sự kiện'} · {d}/{m}</span>
                      </span>
                      <span className={cx('shrink-0 text-sm tabular-nums', left <= 7 ? 'font-semibold text-ink' : 'text-ink-2')}>{left === 0 ? 'Hôm nay' : `${left} ngày`}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Số người theo từng đời, tách trong họ và dâu rể. Vẽ bằng thanh ngang để đọc được cả trên điện thoại. */
function GenerationChart({ members }: { members?: MemberBrief[] }) {
  const rows = useMemo(() => {
    const map = new Map<number, { blood: number; inlaw: number }>();
    for (const m of members ?? []) {
      const g = m.generation ?? 1;
      const r = map.get(g) ?? { blood: 0, inlaw: 0 };
      if (m.is_blood) r.blood++; else r.inlaw++;
      map.set(g, r);
    }
    return [...map].sort((a, b) => a[0] - b[0]).map(([g, r]) => ({ g, ...r, total: r.blood + r.inlaw }));
  }, [members]);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card title="Thành viên theo đời" icon={<Layers />}
      aside={<span className="hidden sm:flex items-center gap-3 text-xs font-normal text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-accent" />Trong họ</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-yellow" />Dâu, rể</span>
      </span>}>
      {!members ? <div className="p-5"><Skeleton className="h-24" /></div> : !rows.length ? <p className="p-5 text-ink-2">Chưa có thành viên.</p> : (
        <table className="w-full my-3 text-sm">
          <caption className="sr-only">Số thành viên theo từng đời</caption>
          <thead className="sr-only"><tr><th>Đời</th><th>Trong họ</th><th>Dâu, rể</th><th>Tổng</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.g}>
                <th scope="row" className="pl-4 sm:pl-5 pr-3 py-1.5 w-px whitespace-nowrap text-left font-medium text-ink-2">Đời {r.g}</th>
                <td className="py-1.5 w-full">
                  <span className="flex h-5 gap-px" aria-hidden>
                    {r.blood > 0 && <span className="h-full rounded-l-sm bg-accent last:rounded-r-sm" style={{ width: `${(r.blood / max) * 100}%` }} />}
                    {r.inlaw > 0 && <span className="h-full rounded-r-sm bg-yellow first:rounded-l-sm" style={{ width: `${(r.inlaw / max) * 100}%` }} />}
                  </span>
                  <span className="sr-only">{r.blood} trong họ</span>
                </td>
                <td className="sr-only">{r.inlaw} dâu, rể</td>
                <td className="pl-3 pr-4 sm:pr-5 py-1.5 w-px text-right font-semibold tabular-nums text-ink">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** Phả đồ thu gọn ngay trên Tổng quan: bấm một người để sang màn soạn phả đồ với người đó đã được chọn. */
function TreePreview({ tree, lines }: { tree?: TreeData; lines?: string }) {
  const nav = useNavigate();
  const ref = useRef<FamilyTreeHandle>(null);
  const model = useTreeModel(tree?.members ?? [], tree?.marriages ?? []);
  const [opt, setOpt] = useState<TreeOptions>({ hideSpouses: false, coupleLines: true, maxGen: 4, collapsed: new Set(), rootId: null });
  return (
    <Card title="Phả đồ" icon={<Network />} className="overflow-hidden"
      aside={<span className="flex items-center gap-2">
        {/* Hai nút ghép liền: thu nhỏ, phóng to. Muốn xem cả cây thì thu nhỏ; soạn chi tiết thì sang màn Soạn phả đồ. */}
        <span role="group" aria-label="Thu phóng phả đồ" className="inline-flex h-8 pointer-coarse:h-10 rounded-lg border border-line-strong bg-surface overflow-hidden divide-x divide-line-strong">
          <button type="button" onClick={() => ref.current?.zoomBy(1 / 1.3)} aria-label="Thu nhỏ" title="Thu nhỏ" className="w-9 pointer-coarse:w-11 inline-flex items-center justify-center text-ink cursor-pointer transition-colors hover:bg-accent-soft hover:text-accent"><ZoomOut aria-hidden className="size-4" /></button>
          <button type="button" onClick={() => ref.current?.zoomBy(1.3)} aria-label="Phóng to" title="Phóng to" className="w-9 pointer-coarse:w-11 inline-flex items-center justify-center text-ink cursor-pointer transition-colors hover:bg-accent-soft hover:text-accent"><ZoomIn aria-hidden className="size-4" /></button>
        </span>
        <LinkButton to="/admin/tree" size="sm" variant="primary" icon={<PenLine aria-hidden />}>Soạn phả đồ</LinkButton>
      </span>}>
      {!tree ? <Loading /> : !tree.members.length ? (
        <div className="flex flex-col items-center text-center px-6 py-12">
          <span aria-hidden className="size-12 inline-flex items-center justify-center rounded-full bg-sunken text-ink-2"><Network className="size-6" /></span>
          <p className="mt-3 font-medium text-ink">Phả đồ chưa có ai</p>
          <p className="mt-1 text-sm text-ink-2">Bắt đầu từ thủy tổ, hoặc nhập cả danh sách từ Excel.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <LinkButton to="/admin/members/new" variant="primary" icon={<UserPlus aria-hidden />}>Thêm thủy tổ</LinkButton>
            <LinkButton to="/admin/members" icon={<FileSpreadsheet aria-hidden />}>Nhập từ Excel</LinkButton>
          </div>
        </div>
      ) : (
        <div className="h-[360px] sm:h-[420px]">
          <FamilyTree ref={ref} model={model} options={opt} lines={lines} selectedId={null} highlight={new Set()}
            onSelect={(id) => nav(`/admin/tree?m=${id}`)}
            onToggle={(id) => setOpt((o) => {
              const c = new Set(o.collapsed);
              const g = model.byId.get(id)?.generation ?? 1;
              if (o.maxGen && g >= o.maxGen) return { ...o, maxGen: null, collapsed: c };
              if (c.has(id)) c.delete(id); else c.add(id);
              return { ...o, collapsed: c };
            })} />
        </div>
      )}
    </Card>
  );
}
