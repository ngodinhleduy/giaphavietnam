// Hiển thị nội dung từ editor (HTML) hoặc nội dung cũ (Markdown), luôn lọc qua DOMPurify trước khi đưa vào trang.
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';
import { cx } from './ui.tsx';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? '';
    if (/^https?:/i.test(href) && !href.startsWith(location.origin)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
  if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
  // Chỉ giữ căn lề, bỏ mọi CSS khác
  const style = node.getAttribute?.('style');
  if (style != null) {
    const m = style.match(/text-align:\s*(left|right|center|justify)/i);
    if (m) node.setAttribute('style', `text-align:${m[1].toLowerCase()}`);
    else node.removeAttribute('style');
  }
});

export function RichContent({ html, className }: { html: string | null | undefined; className?: string }) {
  const clean = useMemo(() => {
    if (!html) return '';
    const raw = /^\s*</.test(html) ? html : (marked.parse(html, { async: false }) as string);
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input'], ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'loading', 'style', 'colspan', 'rowspan'] });
  }, [html]);
  if (!clean) return null;
  return <div className={cx('prose-gp', className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
