import { StrictMode } from 'react';
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
import { AdminLayout } from './admin/AdminLayout.tsx';
import { Dashboard } from './admin/Dashboard.tsx';
import { MemberForm, MembersAdmin } from './admin/Members.tsx';
import { AlbumAdmin, AlbumsAdmin, ArticleForm, ArticlesAdmin, EventsAdmin } from './admin/Content.tsx';
import { SettingsAdmin } from './admin/Settings.tsx';

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
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="members" element={<MembersAdmin />} />
            <Route path="members/:id" element={<MemberForm />} />
            <Route path="articles" element={<ArticlesAdmin />} />
            <Route path="articles/:id" element={<ArticleForm />} />
            <Route path="events" element={<EventsAdmin />} />
            <Route path="albums" element={<AlbumsAdmin />} />
            <Route path="albums/:id" element={<AlbumAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
