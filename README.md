# Gia phả: trang xem cho con cháu + trang quản trị

Một codebase, chạy được ở hai nơi:

| Giai đoạn | Chạy ở đâu | Database | Ảnh |
|---|---|---|---|
| Bây giờ | Cloudflare Workers (miễn phí) | Cloudflare D1 | Google Drive |
| Sau này | Docker trên NAS hoặc VPS | SQLite (một file) | Thư mục trên NAS |

## Có gì trong bản này

**Trang xem (`/`)**
- Phả đồ tương tác: kéo, phóng to, thu gọn từng nhánh, lọc theo đời, ẩn dâu/rể, "chỉ xem hậu duệ" của một người, tìm tên không cần dấu.
- Danh sách thành viên, danh sách theo đời, hồ sơ từng người (cha mẹ, vợ chồng, con).
- Tra quan hệ xưng hô giữa hai người (cách gọi miền Bắc, tính vai theo chi trên chi dưới).
- Lịch sự kiện và ngày giỗ: nhập âm lịch, tự quy đổi ra dương lịch mỗi năm.
- Phả ký / bài viết (Markdown), album ảnh.
- Mã bảo mật: cây phả hệ, hồ sơ, ảnh chân dung và ngày giỗ chỉ hiện sau khi nhập mã. Bài viết, sự kiện, album vẫn công khai.
- Xuất: PNG, SVG, in ra PDF, danh sách CSV mở bằng Excel.

**Trang quản trị (`/admin`)**
- Thêm, sửa, xóa thành viên; gắn cha mẹ, vợ chồng (nhiều vợ có thứ tự), "Lưu và thêm con" để nhập nhanh từng nhánh.
- Đời được tính tự động từ cha mẹ. Chặn trường hợp chọn con cháu của mình làm cha mẹ.
- Ngày mất dương lịch tự đổi ra ngày giỗ âm lịch.
- Bài viết, chuyên mục, sự kiện, album (kéo thả nhiều ảnh, tự thu nhỏ trước khi tải lên).
- Cài đặt: tên trang, logo, ảnh nền, địa chỉ nhà thờ họ + bản đồ, mã bảo mật, tài khoản quản trị.

---

## 1. Chạy thử trên máy

Cần Node.js 22 trở lên.

```bash
npm install
npm run seed      # dữ liệu mẫu: 29 người, 6 đời. Admin: admin / giapha123, mã xem: 1234
npm run dev       # mở http://localhost:5173
```

Khi dùng thật, xóa thư mục `data/` để bắt đầu trống. Lần đầu vào `/admin`, trang sẽ cho tạo tài khoản quản trị.

---

## 2. Đưa lên Cloudflare với tên miền của bạn

**Điều kiện:** tên miền đã được thêm vào Cloudflare (đổi nameserver ở nhà cung cấp tên miền sang 2 nameserver Cloudflare đưa).

```bash
npx wrangler login
npx wrangler d1 create giapha
```

Lệnh trên in ra `database_id`. Mở `wrangler.toml`, dán vào chỗ `REPLACE_WITH_YOUR_D1_ID`.

Bỏ comment dòng `routes` và đổi thành tên miền của bạn, ví dụ:

```toml
routes = [{ pattern = "giapha.hongo.vn", custom_domain = true }]
```

Tạo bảng và đặt secret:

```bash
npm run cf:migrate
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET
```

Deploy:

```bash
npm run cf:deploy
```

Mở `https://giapha.hongo.vn/admin` để tạo tài khoản quản trị đầu tiên. Vào **Cài đặt > Mã bảo mật phả đồ** để bật mã.

> Lúc này chưa tải ảnh lên được vì chưa nối Drive. Mọi thứ khác dùng bình thường.

---

## 3. Kết nối Google Drive

App xin quyền `drive.file`: chỉ đọc và ghi những file do chính nó tạo, không thấy các file khác trong Drive của bạn. Ảnh trên Drive để chế độ riêng tư; người xem lấy ảnh qua app, nên ảnh chân dung vẫn được mã bảo mật bảo vệ.

**Bước 1. Tạo OAuth client** (làm một lần, khoảng 10 phút)

1. Vào [console.cloud.google.com](https://console.cloud.google.com), tạo project mới, ví dụ `giapha`.
2. **APIs & Services > Library**: tìm "Google Drive API", bấm **Enable**.
3. **APIs & Services > OAuth consent screen**: chọn **External**, điền tên app và email. Ở mục Scopes thêm `.../auth/drive.file`.
4. Cũng ở màn hình đó, bấm **Publish app** để chuyển sang **In production**.
   Bước này quan trọng: nếu để ở trạng thái *Testing*, refresh token sẽ hết hạn sau 7 ngày và ảnh ngừng tải. `drive.file` không phải scope nhạy cảm nên không cần Google duyệt.
5. **Credentials > Create credentials > OAuth client ID**, loại **Desktop app**. Lưu lại Client ID và Client secret.

**Bước 2. Lấy refresh token** (trên máy của bạn)

```bash
GDRIVE_CLIENT_ID=xxx GDRIVE_CLIENT_SECRET=yyy npm run gdrive:auth
```

Mở link được in ra, đăng nhập tài khoản Google bạn muốn dùng làm kho, bấm Cho phép. Terminal in ra `GDRIVE_REFRESH_TOKEN=...`.

Google sẽ cảnh báo "app chưa được xác minh" vì đây là app của bạn: bấm **Nâng cao > Đi tới giapha**.

**Bước 3. Đưa vào Cloudflare**

```bash
npx wrangler secret put GDRIVE_CLIENT_ID
npx wrangler secret put GDRIVE_CLIENT_SECRET
npx wrangler secret put GDRIVE_REFRESH_TOKEN
```

Vào **Cài đặt > Lưu trữ file > Kiểm tra kết nối**. Lần đầu, app tự tạo thư mục `GiaPha-Storage` trong Drive.

Không điền `GDRIVE_FOLDER_ID` bằng một thư mục bạn tự tạo: với quyền `drive.file`, app không ghi được vào thư mục đó.

---

## 4. Chuyển sang NAS

Làm khi bạn muốn dữ liệu nằm trong nhà. Tên miền giữ nguyên, người xem không thấy khác biệt.

**4.1. Chuẩn bị trên NAS** (Synology: cài Container Manager; QNAP: Container Station)

```bash
git clone <repo> giapha && cd giapha
cp .env.example .env     # điền JWT_SECRET và các biến GDRIVE_* hiện tại, để STORAGE=gdrive
```

Trong `docker-compose.yml`, đổi `./data` thành thư mục share trên NAS, ví dụ `/volume1/giapha`.

**4.2. Chuyển database từ D1**

Trên máy đã đăng nhập wrangler:

```bash
npx wrangler d1 export giapha --remote --output=giapha.sql
```

Copy `giapha.sql` vào thư mục dự án trên NAS rồi nạp (chạy trước khi khởi động container lần đầu):

```bash
docker compose run --rm -v "$PWD/giapha.sql:/tmp/giapha.sql" giapha \
  node --experimental-strip-types scripts/import-sql.ts /tmp/giapha.sql
```

**4.3. Chạy và chuyển ảnh từ Drive về NAS**

```bash
docker compose up -d --build
docker compose exec giapha node --experimental-strip-types scripts/migrate-storage.ts
```

Sau khi script báo xong, sửa `.env` thành `STORAGE=local`, chạy `docker compose up -d`. Ảnh mới sẽ lưu vào NAS. Ảnh nào chưa chuyển được vẫn đọc từ Drive miễn là các biến `GDRIVE_*` còn trong `.env`.

**4.4. Trỏ tên miền về NAS mà không mở port**

Dùng Cloudflare Tunnel, không cần IP tĩnh hay mở port router:

1. Cloudflare dashboard > **Zero Trust > Networks > Tunnels > Create tunnel**, chọn Cloudflared, copy token vào `CF_TUNNEL_TOKEN` trong `.env`.
2. Bỏ comment service `cloudflared` trong `docker-compose.yml`, chạy `docker compose up -d`.
3. Trong tunnel, thêm **Public hostname**: `giapha.hongo.vn` trỏ tới `http://giapha:8787`.
4. Gỡ custom domain khỏi Worker (Workers > giapha > Settings > Domains) để tunnel nhận tên miền.

**Sao lưu:** toàn bộ dữ liệu nằm trong một thư mục (`giapha.db` + `uploads/`). Bật Snapshot hoặc Hyper Backup cho thư mục đó là đủ.

---

## Cấu trúc code

```
src/server/app.ts        API (Hono), dùng chung cho Workers và Node
src/server/worker.ts     entry Cloudflare
src/server/node.ts       entry Docker
src/server/storage*.ts   Google Drive, thư mục local
src/shared/lunar.ts      âm lịch (thuật toán Hồ Ngọc Đức)
src/shared/kinship.ts    tính xưng hô
src/web/site/            trang xem
src/web/admin/           trang quản trị
src/web/components/FamilyTree.tsx   cây phả hệ (SVG + d3-zoom)
migrations/              schema SQL
```

## Giới hạn hiện tại

- Xưng hô theo cách gọi miền Bắc. Các quan hệ xa hơn bốn đời hoặc qua hai lớp hôn nhân chỉ trả về mô tả chung.
- Xuất PNG và SVG không kèm ảnh chân dung, vì ảnh cần mã bảo mật mới tải được. Muốn có ảnh, dùng In / Lưu PDF.
- Mỗi file tải lên tối đa 15 MB.
- Chưa có phân quyền theo chi (mọi tài khoản quản trị có toàn quyền).
