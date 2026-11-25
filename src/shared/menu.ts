// Menu của trang xem: lưu trong settings (khóa "menu") dưới dạng JSON. Dùng chung cho máy chủ và trình duyệt.
export type MenuItem = { type: 'page' | 'category' | 'link'; target: string; label: string; visible: boolean };
export type MenuLink = { to: string; label: string; external: boolean };

export const MENU_PAGES: Record<string, { to: string; label: string }> = {
  home: { to: '/', label: 'Trang chủ' },
  tree: { to: '/pha-do', label: 'Phả đồ' },
  articles: { to: '/bai-viet', label: 'Phả ký' },
  events: { to: '/su-kien', label: 'Sự kiện' },
  albums: { to: '/album', label: 'Thư viện' },
  contact: { to: '/lien-he', label: 'Liên hệ' },
};

export const defaultMenu = (): MenuItem[] =>
  Object.entries(MENU_PAGES).map(([target, p]) => ({ type: 'page', target, label: p.label, visible: true }));

const okLink = (t: string) => /^https?:\/\/[^\s]+$/i.test(t) || /^\/[^\s/][^\s]*$/.test(t) || t === '/';

/** Đọc menu đã lưu, bỏ mục sai, bổ sung trang có sẵn còn thiếu. Trang chủ luôn hiện. */
export function parseMenu(raw: unknown): MenuItem[] {
  let list: any[] = [];
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    if (Array.isArray(v)) list = v;
  } catch { /* JSON hỏng: dùng mặc định */ }
  const out: MenuItem[] = [];
  const seen = new Set<string>();
  for (const it of list.slice(0, 24)) {
    const type = it?.type;
    const target = String(it?.target ?? '').trim();
    const label = String(it?.label ?? '').trim().slice(0, 40);
    if (!label || !target) continue;
    if (type === 'page' && !MENU_PAGES[target]) continue;
    if (type === 'link' && !okLink(target)) continue;
    if (type !== 'page' && type !== 'category' && type !== 'link') continue;
    const key = `${type}:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type, target, label, visible: target === 'home' && type === 'page' ? true : it.visible !== false });
  }
  for (const d of defaultMenu()) if (!seen.has(`page:${d.target}`)) out.push(d);
  return out;
}

/** Các mục đang hiện, đã đổi thành đường dẫn. Chuyên mục đã bị xóa thì bỏ qua. */
export function menuLinks(items: MenuItem[], categorySlugs: Set<string>): MenuLink[] {
  const out: MenuLink[] = [];
  for (const it of items) {
    if (!it.visible) continue;
    if (it.type === 'page') out.push({ to: MENU_PAGES[it.target].to, label: it.label, external: false });
    else if (it.type === 'category') {
      if (categorySlugs.has(it.target)) out.push({ to: `/bai-viet?c=${encodeURIComponent(it.target)}`, label: it.label, external: false });
    } else out.push({ to: it.target, label: it.label, external: /^https?:/i.test(it.target) });
  }
  return out;
}
