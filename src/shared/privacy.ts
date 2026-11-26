/** Nội dung mặc định của trang Chính sách bảo mật. Quản trị viên có thể thay bằng bản riêng trong Cấu hình website. */
export function defaultPrivacy(siteName: string, contact?: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return [
    `<p>Áp dụng cho trang ${esc(siteName)}.</p>`,
    '<h2>Trang này thu thập gì</h2>',
    '<p>Trang lưu thông tin gia phả do ban quản trị dòng họ nhập: họ tên, năm sinh, năm mất, ngày giỗ, quan hệ cha mẹ, vợ chồng, tiểu sử và ảnh. Trang không dùng cookie quảng cáo và không theo dõi hành vi người xem.</p>',
    '<p>Khi bạn gửi lời nhắn ở trang Liên hệ, trang lưu họ tên, số điện thoại hoặc email (nếu bạn điền) và nội dung lời nhắn. Chỉ quản trị viên đọc được, chỉ dùng để trả lời bạn, và sẽ được xóa khi bạn yêu cầu.</p>',
    '<p>Trang chỉ dùng hai cookie kỹ thuật: một cookie ghi nhớ bạn đã nhập mã xem phả đồ, một cookie giữ phiên đăng nhập của người quản trị.</p>',
    '<h2>Ai được xem</h2>',
    '<p>Khi ban quản trị bật mã bảo mật, cây phả hệ, hồ sơ thành viên, ảnh chân dung và ngày giỗ chỉ hiển thị cho người có mã do ban liên lạc dòng họ cung cấp. Bài viết, lịch sự kiện và album ảnh là công khai.</p>',
    '<h2>Google Drive</h2>',
    '<p>Ảnh và tài liệu tải lên được lưu trong Google Drive của ban quản trị dòng họ. Trang chỉ xin quyền drive.file: chỉ tạo, đọc và xóa những file do chính trang này tạo ra, không truy cập được bất kỳ file nào khác trong Drive. Dữ liệu từ Google không được chia sẻ cho bên thứ ba và không dùng cho mục đích nào khác ngoài hiển thị trên trang.</p>',
    '<h2>Sửa hoặc xóa thông tin</h2>',
    `<p>Nếu bạn muốn sửa hoặc gỡ thông tin của mình hay người thân, hãy liên hệ ban liên lạc dòng họ${contact ? `: ${esc(contact)}` : ' qua trang Liên hệ'}. Yêu cầu sẽ được xử lý trong vòng 30 ngày.</p>`,
  ].join('\n');
}
