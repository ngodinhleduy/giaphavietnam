import { useApi } from '../lib/api.ts';
import { RichContent } from '../components/RichContent.tsx';
import { defaultPrivacy } from '../../shared/privacy.ts';
import { Loading } from '../components/ui.tsx';
import { Container, Crumbs, useSite } from './SiteLayout.tsx';

/** Trang chính sách bảo mật. Nội dung soạn trong Cấu hình website; để trống thì dùng bản mặc định.
    Google cũng yêu cầu trang này khi publish OAuth app dùng Drive. */
export function PrivacyPage() {
  const { site } = useSite();
  const { data, loading } = useApi<{ html: string }>('/privacy');
  const custom = data?.html && data.html.replace(/<[^>]*>/g, '').trim() ? data.html : '';
  return (
    <Container size="text" className="py-6 sm:py-10">
      <Crumbs items={[{ to: '/', label: 'Trang chủ' }]} current="Chính sách bảo mật" />
      <article>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight">Chính sách bảo mật</h1>
        {loading && !data ? <Loading /> : <RichContent className="mt-6" html={custom || defaultPrivacy(site.site_name, site.contact_phone || site.contact_email || '')} />}
      </article>
    </Container>
  );
}
