import { Link, useParams } from 'react-router-dom';
import { RichContent } from '../components/RichContent.tsx';
import { useApi } from '../lib/api.ts';
import type { MemberBrief, MemberDetail } from '../lib/types.ts';
import { formatDate, lifespan } from '../lib/format.ts';
import { Container, Crumbs } from './SiteLayout.tsx';
import { Avatar, Badge, ErrorState, Loading } from '../components/ui.tsx';

export function MemberPage() {
  const { id } = useParams();
  const { data: m, error, loading, reload } = useApi<MemberDetail>(`/members/${id}`);
  if (loading) return <Loading />;
  if (error)
    return (
      <Container size="narrow" className="py-10">
        <ErrorState error={error.locked ? 'Cần nhập mã bảo mật ở trang Phả đồ để xem hồ sơ.' : error} onRetry={reload} />
        {error.locked && <Link to="/pha-do" className="inline-block mt-4 text-accent font-medium">Đến trang Phả đồ</Link>}
      </Container>
    );
  if (!m) return null;
  const facts: [string, string | null | undefined][] = [
    ['Ngày sinh', formatDate(m.birth_date)],
    ['Ngày mất', m.is_deceased ? formatDate(m.death_date) || 'Không rõ' : null],
    ['Ngày giỗ (âm lịch)', m.death_lunar_day ? `${m.death_lunar_day} tháng ${m.death_lunar_month}` : null],
    ['Quê quán', m.hometown],
    ['Nghề nghiệp', m.occupation],
    ['Nơi an táng', m.burial_place],
  ];
  return (
    <Container className="py-6 sm:py-10">
      <Crumbs items={[{ to: '/pha-do', label: 'Phả đồ' }]} current={m.full_name} />
      <div className="flex flex-row gap-4 sm:gap-6 items-center sm:items-start">
        <Avatar m={m} size={88} />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">{m.full_name}</h1>
          {m.alias && <p className="mt-1 text-ink-2">{m.alias}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {m.generation && <Badge tone="accent">Đời thứ {m.generation}</Badge>}
            <Badge>{m.gender === 'male' ? 'Nam' : 'Nữ'}</Badge>
            {!m.is_blood && <Badge>{m.gender === 'female' ? 'Con dâu' : 'Con rể'}</Badge>}
            {m.branch && <Badge tone="gold">{m.branch}</Badge>}
            {m.is_deceased ? <Badge>Đã mất</Badge> : null}
          </div>
          <Link to={`/pha-do?focus=${m.id}`} className="inline-flex items-center min-h-10 mt-2 text-sm font-medium text-accent hover:underline">
            Xem trên cây phả hệ
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        <div className="min-w-0">
          <dl className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-8 rounded-xl border border-line bg-surface px-5">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 border-b border-line last:border-0">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-ink font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {m.bio && (
            <section className="mt-8 max-w-[68ch]">
              <h2 className="font-serif text-xl font-semibold mb-3">Tiểu sử</h2>
              <RichContent html={m.bio} />
            </section>
          )}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 min-w-0">
          <Relatives title="Cha mẹ" list={[m.father, m.mother].filter(Boolean) as MemberBrief[]} />
          <Relatives title="Vợ / chồng" list={m.spouses} note={(s: any) => (m.spouses.length > 1 ? `Thứ ${s.order_no}` : '')} />
          <Relatives title={`Con (${m.children.length})`} list={m.children} className="sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    </Container>
  );
}

function Relatives({ title, list, note, className }: {
  title: string; list: MemberBrief[]; note?: (m: MemberBrief) => string; className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-2">{title}</h2>
      {!list.length ? <p className="text-ink-3 text-sm">Chưa có thông tin.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {list.map((r) => (
            <li key={r.id}>
              <Link to={`/thanh-vien/${r.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 hover:border-line-strong">
                <Avatar m={r} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{r.full_name}</span>
                  <span className="block text-sm text-ink-2">{[lifespan(r), note?.(r)].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
