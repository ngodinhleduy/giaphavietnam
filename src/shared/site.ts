// Mẫu giao diện của trang xem và dữ liệu trang Liên hệ. Dùng chung cho máy chủ và trình duyệt.
export const TEMPLATES = [
  { id: 'trong-dong', name: 'Trống đồng', desc: 'Nền chàm, trống đồng Đông Sơn xoay chậm. Trang trọng, hợp nhà thờ họ.' },
  { id: 'giay-do', name: 'Giấy dó', desc: 'Nền giấy sáng, rồng vàng bên phải, chữ canh trái. Ấm, dễ đọc.' },
  { id: 'son', name: 'Sơn son', desc: 'Nền đỏ son với đàn chim Lạc. Nổi bật, hợp dịp lễ tết.' },
  { id: 'toi-gian', name: 'Tối giản', desc: 'Nền trắng, không họa tiết, chữ lớn. Gọn như một trang tài liệu.' },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];
export const templateOf = (v: unknown): TemplateId => (TEMPLATES.some((t) => t.id === v) ? (v as TemplateId) : 'trong-dong');

export type ContactPerson = { name: string; role: string; phone: string };
export function parsePeople(raw: unknown): ContactPerson[] {
  let list: any[] = [];
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    if (Array.isArray(v)) list = v;
  } catch { /* JSON hỏng: coi như chưa có ai */ }
  return list.slice(0, 8).map((p) => ({
    name: String(p?.name ?? '').trim().slice(0, 80),
    role: String(p?.role ?? '').trim().slice(0, 80),
    phone: String(p?.phone ?? '').trim().slice(0, 30),
  })).filter((p) => p.name);
}
/** Chỉ nhận liên kết http(s); trả chuỗi rỗng nếu không hợp lệ. */
export const safeUrl = (v: unknown) => {
  const s = String(v ?? '').trim();
  return /^https?:\/\/[^\s]+$/i.test(s) ? s.slice(0, 300) : '';
};
