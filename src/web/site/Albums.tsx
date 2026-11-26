import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, fileUrl } from '../lib/api.ts';
import { Container, Crumbs } from './SiteLayout.tsx';
import { EmptyState, ErrorState, Loading, PageHeader } from '../components/ui.tsx';

type Album = { id: number; title: string; description: string | null; photo_count: number; cover: number | null };
type Photo = { id: number; file_id: number; caption: string | null };

export function AlbumsPage() {
  const { data, error, loading, reload } = useApi<Album[]>('/albums');
  return (
    <Container className="py-10">
      <PageHeader title="Thư viện ảnh" subtitle="Hình ảnh nhà thờ họ, lễ tế và những lần con cháu sum họp." />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="Chưa có album nào" />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.map((a) => (
            <li key={a.id}>
              <Link to={`/album/${a.id}`} className="group block">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-sunken border border-line">
                  {a.cover ? <img src={fileUrl(a.cover)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" /> : null}
                </div>
                <p className="mt-3 font-semibold text-ink group-hover:text-accent">{a.title}</p>
                <p className="text-sm text-ink-2">{a.photo_count} ảnh</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

export function AlbumPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<Album & { photos: Photo[] }>(`/albums/${id}`);
  const [idx, setIdx] = useState<number | null>(null);
  const photos = data?.photos ?? [];
  useEffect(() => {
    if (idx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null);
      if (e.key === 'ArrowRight') setIdx((i) => (i! + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIdx((i) => (i! - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, photos.length]);
  if (loading) return <Loading />;
  if (error) return <Container className="py-10"><ErrorState error={error} onRetry={reload} /></Container>;
  if (!data) return null;
  return (
    <Container size="wide" className="py-10">
      <Crumbs items={[{ to: '/album', label: 'Thư viện' }]} current={data.title} />
      <PageHeader title={data.title} subtitle={data.description ?? undefined} />
      {!photos.length ? <EmptyState title="Album chưa có ảnh" /> : (
        <ul className="columns-2 md:columns-3 xl:columns-4 2xl:columns-5 gap-2 sm:gap-3 [&>li]:mb-2 sm:[&>li]:mb-3">
          {photos.map((p, i) => (
            <li key={p.id} className="break-inside-avoid">
              <button onClick={() => setIdx(i)} className="block w-full cursor-zoom-in" aria-label={p.caption || `Ảnh ${i + 1}`}>
                <img src={fileUrl(p.file_id)} alt={p.caption ?? ''} loading="lazy" className="w-full rounded-lg" />
              </button>
              {p.caption && <p className="mt-1 text-sm text-ink-2">{p.caption}</p>}
            </li>
          ))}
        </ul>
      )}
      {idx != null && photos[idx] && (
        <div role="dialog" aria-modal aria-label="Xem ảnh" className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setIdx(null)}>
          <div className="flex justify-between items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 text-white/90 text-sm">
            <span>{idx + 1} / {photos.length}</span>
            <button className="size-10 text-2xl cursor-pointer" aria-label="Đóng">×</button>
          </div>
          <div className="flex-1 flex items-center justify-center px-1 sm:px-4 min-h-0" onClick={(e) => e.stopPropagation()}>
            <button className="shrink-0 size-12 text-white text-3xl cursor-pointer" aria-label="Ảnh trước" onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}>‹</button>
            <img src={fileUrl(photos[idx].file_id)} alt={photos[idx].caption ?? ''} className="max-h-full max-w-full object-contain" />
            <button className="shrink-0 size-12 text-white text-3xl cursor-pointer" aria-label="Ảnh sau" onClick={() => setIdx((idx + 1) % photos.length)}>›</button>
          </div>
          {photos[idx].caption && <p className="p-4 text-center text-white/90">{photos[idx].caption}</p>}
        </div>
      )}
    </Container>
  );
}
