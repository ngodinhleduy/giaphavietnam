import { Link } from 'react-router-dom';
import { Container, useSite } from './SiteLayout.tsx';

/** Trang chính sách bảo mật. Google yêu cầu khi publish OAuth app dùng Drive. */
export function PrivacyPage() {
  const { site } = useSite();
  return (
    <Container size="text" className="py-10">
      <article className="prose-gp">
        <h1 className="font-serif text-3xl font-semibold !mt-0">Chính sách bảo mật</h1>
        <p className="text-ink-2">Áp dụng cho trang {site.site_name}. Cập nhật ngày 25/11/2026.</p>

        <h2>Trang này thu thập gì</h2>
        <p>Trang lưu thông tin gia phả do ban quản trị dòng họ nhập: họ tên, năm sinh, năm mất, ngày giỗ, quan hệ cha mẹ, vợ chồng, tiểu sử và ảnh. Trang không thu thập thông tin của người xem, không dùng cookie quảng cáo và không theo dõi hành vi.</p>
        <p>Trang chỉ dùng hai cookie kỹ thuật: một cookie ghi nhớ bạn đã nhập mã xem phả đồ, một cookie giữ phiên đăng nhập của người quản trị.</p>

        <h2>Ai được xem</h2>
        <p>Cây phả hệ, hồ sơ thành viên, ảnh chân dung và ngày giỗ chỉ hiển thị cho người có mã bảo mật do ban liên lạc dòng họ cung cấp. Bài viết, lịch sự kiện và album ảnh là công khai.</p>

        <h2>Google Drive</h2>
        <p>Ảnh và tài liệu tải lên được lưu trong Google Drive của ban quản trị dòng họ. Trang chỉ xin quyền <code>drive.file</code>: chỉ tạo, đọc và xóa những file do chính trang này tạo ra, không truy cập được bất kỳ file nào khác trong Drive. Dữ liệu từ Google không được chia sẻ cho bên thứ ba và không dùng cho mục đích nào khác ngoài hiển thị trên trang.</p>

        <h2>Sửa hoặc xóa thông tin</h2>
        <p>Nếu bạn muốn sửa hoặc gỡ thông tin của mình hay người thân, hãy liên hệ ban liên lạc dòng họ{site.contact ? `: ${site.contact}` : ''}. Yêu cầu sẽ được xử lý trong vòng 30 ngày.</p>

        <p><Link to="/">Về trang chủ</Link></p>
      </article>
    </Container>
  );
}
