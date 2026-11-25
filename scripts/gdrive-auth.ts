// Lấy GDRIVE_REFRESH_TOKEN cho tài khoản Google của bạn (chạy một lần trên máy cá nhân).
//
//   GDRIVE_CLIENT_ID=xxx GDRIVE_CLIENT_SECRET=yyy npm run gdrive:auth
//
// Script mở một server tạm ở 127.0.0.1, in ra link đăng nhập Google. Sau khi bạn bấm "Cho phép",
// refresh token được in ra màn hình. Quyền xin là drive.file: app CHỈ thấy file do chính nó tạo,
// không đọc được phần còn lại trong Drive của bạn.
import { createServer } from 'node:http';

const clientId = process.env.GDRIVE_CLIENT_ID;
const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Thiếu GDRIVE_CLIENT_ID hoặc GDRIVE_CLIENT_SECRET.');
  process.exit(1);
}
const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}/callback`;
const state = crypto.randomUUID();
const url =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

const server = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', redirect);
  if (u.pathname !== '/callback') return res.end();
  if (u.searchParams.get('state') !== state) return res.end('State không khớp.');
  const code = u.searchParams.get('code');
  if (!code) return res.end('Không có mã xác thực: ' + u.searchParams.get('error'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  });
  const j = (await r.json()) as { refresh_token?: string; error?: string; error_description?: string };
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  if (j.refresh_token) {
    res.end('Xong. Quay lại cửa sổ dòng lệnh để lấy refresh token.');
    console.log('\nGDRIVE_REFRESH_TOKEN=' + j.refresh_token + '\n');
  } else {
    res.end('Lỗi: ' + (j.error_description ?? j.error));
    console.error('Lỗi:', j);
  }
  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Mở link sau trong trình duyệt và đăng nhập tài khoản Google sẽ dùng làm kho lưu trữ:\n');
  console.log(url + '\n');
});
