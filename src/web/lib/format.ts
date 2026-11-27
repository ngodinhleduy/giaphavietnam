import type { MemberBrief } from './types.ts';

export const year = (d?: string | null) => (d ? d.slice(0, 4) : '');

export function lifespan(m: Pick<MemberBrief, 'birth_date' | 'death_date' | 'is_deceased'>) {
  const b = year(m.birth_date);
  const d = year(m.death_date);
  if (!b && !d) return m.is_deceased ? 'Đã mất' : '';
  if (m.is_deceased) return `${b || '?'} – ${d || '?'}`;
  return b ? `Sinh ${b}` : '';
}

export function formatDate(s?: string | null) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (d) return `${Number(d)}/${Number(m)}/${y}`;
  if (m) return `${Number(m)}/${y}`;
  return y;
}

const WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export function weekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
}

export function daysUntil(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-1)[0]
    ?.charAt(0)
    .toUpperCase() ?? '?';
