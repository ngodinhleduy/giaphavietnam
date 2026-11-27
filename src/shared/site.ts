// Mẫu giao diện của trang xem và dữ liệu trang Liên hệ. Dùng chung cho máy chủ và trình duyệt.
export const TEMPLATES = [
  { id: 'trong-dong', name: 'Trống đồng', desc: 'Tông xanh chàm, góc vuông. Trống đồng Đông Sơn xoay chậm ở đầu trang. Trang trọng, hợp nhà thờ họ.' },
  { id: 'giay-do', name: 'Giấy dó', desc: 'Tông vàng giấy dó, nhấn cam đậm, góc vuông. Rồng vàng bên phải, chữ canh trái.' },
  { id: 'son', name: 'Sơn son', desc: 'Tông đỏ son trên nền giấy cũ, bo góc. Đàn chim Lạc ở đầu trang. Ấm, hợp dịp lễ tết.' },
  { id: 'toi-gian', name: 'Tối giản', desc: 'Đơn sắc đen trắng, bo góc nhẹ, không họa tiết, chữ lớn. Gọn như một trang tài liệu.' },
  { id: 'gom-lam', name: 'Gốm lam', desc: 'Trắng sứ, xanh cobalt, bo góc lớn. Bố cục tạp chí: đầu trang chia đôi chữ và ảnh, bài viết xếp lưới ba cột.' },
  { id: 'hoang-thanh', name: 'Hoàng thành', desc: 'Vàng hoàng thổ, nâu gỗ lim, góc vuông viền kép. Ảnh lớn gần kín màn hình, khung chữ canh giữa, sự kiện xếp theo trục thời gian.' },
  { id: 'ngoi-reu', name: 'Ngói rêu', desc: 'Xanh rêu, nhấn đỏ ngói. Menu dọc cố định bên trái, nội dung một cột, lịch sự kiện bám theo khi cuộn.' },
  { id: 'muc-tau', name: 'Mực tàu', desc: 'Mực đen trên giấy xuyến, dấu triện đỏ. Mọi thứ canh giữa trong một cột hẹp, danh sách chữ thay cho thẻ.' },
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

/** Bố cục trang chủ của từng mẫu. Bốn mẫu đầu dùng chung bố cục gốc, chỉ khác phần đầu trang. */
export type HomeLayout = 'classic' | 'magazine' | 'monument' | 'sidebar' | 'scroll';
export const layoutOf = (t: TemplateId): HomeLayout =>
  t === 'gom-lam' ? 'magazine' : t === 'hoang-thanh' ? 'monument' : t === 'ngoi-reu' ? 'sidebar' : t === 'muc-tau' ? 'scroll' : 'classic';
