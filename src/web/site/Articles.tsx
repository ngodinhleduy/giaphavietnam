import { Link, useParams, useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import { useApi, fileUrl } from '../lib/api.ts';
import type { ArticleBrief } from '../lib/types.ts';
import { formatDate } from '../lib/format.ts';
import { Container, useSite } from './SiteLayout.tsx';
import { EmptyState, ErrorState, Loading, PageHeader, cx } from '../components/ui.tsx';

export function ArticlesPage() {
  const { site } = useSite();
  const [params, setParams] = useSearchParams();
  const c = params.get('c') ?? '';
  const { data, error, loading, reload } = useApi<ArticleBrief[]>(`/articles${c ? `?category=${c}` : ''}`);
  const current = site.categories.find((x) => x.slug === c);
  return (
    <Container className="py-10">
      <PageHeader title={current?.name ?? 'Phả ký & bài viết'} subtitle="Lịch sử, nhân vật và những ghi chép của dòng họ." />
      <div className="flex gap-2 mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none]">
        {[{ slug: '', name: 'Tất cả' }, ...site.categories].map((x) => (
          <button key={x.slug} onClick={() => setParams(x.slug ? { c: x.slug } : {})}
            className={cx('h-9 pointer-coarse:h-10 px-4 shrink-0 whitespace-nowrap rounded-full text-sm font-medium border cursor-pointer',
              c === x.slug ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink')}>
            {x.name}
          </button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="Chưa có bài viết trong mục này" />
      ) : (
        <ul className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => (
            <li key={a.id}>
              <Link to={`/bai-viet/${a.slug}`} className="group block rounded-xl border border-line bg-surface overflow-hidden hover:shadow-sm h-full">
                {a.cover_file_id ? (
                  <img src={fileUrl(a.cover_file_id)} alt="" className="w-full aspect-[16/9] object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[16/9] bg-sunken flex items-center justify-center font-serif text-4xl text-line-strong">❦</div>
                )}
                <div className="p-5">
                  <p className="text-xs font-medium text-gold uppercase tracking-wide">{a.category_name ?? 'Bài viết'} · {formatDate(a.created_at.slice(0, 10))}</p>
                  <h2 className="mt-2 font-semibold text-lg text-ink group-hover:text-accent leading-snug">{a.title}</h2>
                  {a.summary && <p className="mt-2 text-ink-2 line-clamp-3">{a.summary}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

export function ArticlePage() {
  const { slug } = useParams();
  const { data: a, error, loading, reload } = useApi<any>(`/articles/${slug}`);
  if (loading) return <Loading />;
  if (error) return <Container size="narrow" className="py-10"><ErrorState error={error} onRetry={reload} /></Container>;
  if (!a) return null;
  return (
    <Container size="text" className="py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-2 mb-6">
        <Link to="/bai-viet" className="hover:text-accent">Phả ký</Link>
        {a.category_name && <> <span aria-hidden>/</span> <Link to={`/bai-viet?c=${a.category_slug}`} className="hover:text-accent">{a.category_name}</Link></>}
      </nav>
      <article>
        <h1 className="font-serif text-[1.75rem] sm:text-4xl font-semibold leading-tight">{a.title}</h1>
        <p className="mt-3 text-sm text-ink-3">Cập nhật {formatDate((a.updated_at ?? a.created_at).slice(0, 10))}</p>
        {a.summary && <p className="mt-5 text-lg text-ink-2 leading-relaxed">{a.summary}</p>}
        {a.cover_file_id && <img src={fileUrl(a.cover_file_id)} alt="" className="mt-6 w-full rounded-xl" />}
        <div className="prose-gp mt-8" dangerouslySetInnerHTML={{ __html: marked.parse(a.content ?? '', { async: false }) as string }} />
      </article>
    </Container>
  );
}
