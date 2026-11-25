import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import './index.css';
import { ToastProvider } from './components/ui.tsx';
import { SiteLayout, Container } from './site/SiteLayout.tsx';
import { Home } from './site/Home.tsx';
import { TreePage } from './site/TreePage.tsx';
import { MemberPage } from './site/MemberPage.tsx';
import { ArticlePage, ArticlesPage } from './site/Articles.tsx';
import { EventsPage } from './site/Events.tsx';
import { AlbumPage, AlbumsPage } from './site/Albums.tsx';
import { PrivacyPage } from './site/Privacy.tsx';
import { Loading } from './components/ui.tsx';

// Trang quản trị tải riêng (có trình soạn thảo), trang xem không phải tải phần này
const L = <T extends Record<string, any>>(f: () => Promise<T>, name: keyof T) =>
  lazy(() => f().then((m) => ({ default: m[name] as React.ComponentType })));
const AdminLayout = L(() => import('./admin/AdminLayout.tsx'), 'AdminLayout');
const Dashboard = L(() => import('./admin/Dashboard.tsx'), 'Dashboard');
const MembersAdmin = L(() => import('./admin/Members.tsx'), 'MembersAdmin');
const MemberForm = L(() => import('./admin/Members.tsx'), 'MemberForm');
const ArticlesAdmin = L(() => import('./admin/Content.tsx'), 'ArticlesAdmin');
const ArticleForm = L(() => import('./admin/Content.tsx'), 'ArticleForm');
const EventsAdmin = L(() => import('./admin/Content.tsx'), 'EventsAdmin');
const AlbumsAdmin = L(() => import('./admin/Content.tsx'), 'AlbumsAdmin');
const AlbumAdmin = L(() => import('./admin/Content.tsx'), 'AlbumAdmin');
const SettingsAdmin = L(() => import('./admin/Settings.tsx'), 'SettingsAdmin');
const AdminsAdmin = L(() => import('./admin/Admins.tsx'), 'AdminsAdmin');
const TreeAdmin = L(() => import('./admin/TreeAdmin.tsx'), 'TreeAdmin');

function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="font-serif text-5xl text-line-strong">404</p>
      <p className="mt-3 text-ink-2">Không tìm thấy trang này.</p>
      <Link to="/" className="inline-block mt-6 text-accent font-medium">Về trang chủ</Link>
    </Container>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="pha-do" element={<TreePage />} />
            <Route path="thanh-vien/:id" element={<MemberPage />} />
            <Route path="bai-viet" element={<ArticlesPage />} />
            <Route path="bai-viet/:slug" element={<ArticlePage />} />
            <Route path="su-kien" element={<EventsPage />} />
            <Route path="album" element={<AlbumsPage />} />
            <Route path="album/:id" element={<AlbumPage />} />
            <Route path="chinh-sach-bao-mat" element={<PrivacyPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="tree" element={<TreeAdmin />} />
            <Route path="members" element={<MembersAdmin />} />
            <Route path="members/:id" element={<MemberForm />} />
            <Route path="articles" element={<ArticlesAdmin />} />
            <Route path="articles/:id" element={<ArticleForm />} />
            <Route path="events" element={<EventsAdmin />} />
            <Route path="albums" element={<AlbumsAdmin />} />
            <Route path="albums/:id" element={<AlbumAdmin />} />
            <Route path="admins" element={<AdminsAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
