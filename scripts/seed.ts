// Tạo dữ liệu mẫu (họ Nguyễn giả định) để thử giao diện. Chạy: npm run seed
// Tạo admin mặc định: admin / giapha123 (đổi ngay sau khi đăng nhập).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openNodeDb } from '../src/server/db-node.ts';
import { hashPassword } from '../src/server/auth.ts';
import { recomputeGenerations } from '../src/server/app.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = openNodeDb(process.env.DB_FILE ?? join(root, 'data/giapha.db'), join(root, 'migrations'));

const exists = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM members');
if (exists?.n) {
  console.log('Đã có dữ liệu, bỏ qua seed.');
  process.exit(0);
}

type M = { key: string; name: string; g: 'male' | 'female'; f?: string; m?: string; o?: number; b?: string; d?: string;
  gio?: [number, number]; blood?: 0; spouse?: string; branch?: string; alias?: string; bio?: string };

const people: M[] = [
  { key: 'thuy', name: 'Nguyễn Văn Thủy', g: 'male', alias: 'Thủy tổ', b: '1820', d: '1890', gio: [12, 3], bio: 'Thủy tổ, người lập nghiệp tại làng.' },
  { key: 'thuyb', name: 'Lê Thị Hiền', g: 'female', blood: 0, spouse: 'thuy', b: '1825', d: '1895', gio: [8, 10] },
  { key: 'a1', name: 'Nguyễn Văn An', g: 'male', f: 'thuy', m: 'thuyb', o: 1, b: '1850', d: '1920', gio: [5, 1], branch: 'Chi trưởng' },
  { key: 'a1v', name: 'Trần Thị Mai', g: 'female', blood: 0, spouse: 'a1', b: '1855', d: '1925', gio: [20, 6] },
  { key: 'a2', name: 'Nguyễn Văn Bình', g: 'male', f: 'thuy', m: 'thuyb', o: 2, b: '1853', d: '1930', gio: [17, 8], branch: 'Chi thứ' },
  { key: 'a2v', name: 'Phạm Thị Lan', g: 'female', blood: 0, spouse: 'a2', b: '1858', d: '1932', gio: [2, 2] },
  { key: 'a3', name: 'Nguyễn Thị Cúc', g: 'female', f: 'thuy', m: 'thuyb', o: 3, b: '1856', d: '1928' },
  { key: 'b1', name: 'Nguyễn Văn Cường', g: 'male', f: 'a1', m: 'a1v', o: 1, b: '1880', d: '1950', gio: [9, 9], branch: 'Chi trưởng' },
  { key: 'b1v', name: 'Đỗ Thị Hoa', g: 'female', blood: 0, spouse: 'b1', b: '1884', d: '1960' },
  { key: 'b2', name: 'Nguyễn Văn Dũng', g: 'male', f: 'a1', m: 'a1v', o: 2, b: '1883', d: '1955', branch: 'Chi trưởng' },
  { key: 'b3', name: 'Nguyễn Văn Đức', g: 'male', f: 'a2', m: 'a2v', o: 1, b: '1885', d: '1962', gio: [15, 7], branch: 'Chi thứ' },
  { key: 'b3v', name: 'Vũ Thị Nga', g: 'female', blood: 0, spouse: 'b3', b: '1890', d: '1970' },
  { key: 'b4', name: 'Nguyễn Thị Hạnh', g: 'female', f: 'a2', m: 'a2v', o: 2, b: '1888', d: '1965' },
  { key: 'c1', name: 'Nguyễn Văn Giang', g: 'male', f: 'b1', m: 'b1v', o: 1, b: '1910', d: '1985', gio: [24, 11], branch: 'Chi trưởng' },
  { key: 'c1v', name: 'Hoàng Thị Thu', g: 'female', blood: 0, spouse: 'c1', b: '1915', d: '1995' },
  { key: 'c2', name: 'Nguyễn Thị Hòa', g: 'female', f: 'b1', m: 'b1v', o: 2, b: '1913', d: '1990' },
  { key: 'c3', name: 'Nguyễn Văn Hùng', g: 'male', f: 'b3', m: 'b3v', o: 1, b: '1915', d: '1990', branch: 'Chi thứ' },
  { key: 'c3v', name: 'Bùi Thị Yến', g: 'female', blood: 0, spouse: 'c3', b: '1920', d: '2001' },
  { key: 'c4', name: 'Nguyễn Văn Khang', g: 'male', f: 'b3', m: 'b3v', o: 2, b: '1918', d: '1999', branch: 'Chi thứ' },
  { key: 'd1', name: 'Nguyễn Văn Long', g: 'male', f: 'c1', m: 'c1v', o: 1, b: '1940', d: '2015', gio: [3, 4], branch: 'Chi trưởng' },
  { key: 'd1v', name: 'Ngô Thị Liên', g: 'female', blood: 0, spouse: 'd1', b: '1945' },
  { key: 'd2', name: 'Nguyễn Văn Minh', g: 'male', f: 'c1', m: 'c1v', o: 2, b: '1944', branch: 'Chi trưởng' },
  { key: 'd3', name: 'Nguyễn Văn Nam', g: 'male', f: 'c3', m: 'c3v', o: 1, b: '1946', branch: 'Chi thứ' },
  { key: 'd3v', name: 'Lý Thị Oanh', g: 'female', blood: 0, spouse: 'd3', b: '1950' },
  { key: 'd4', name: 'Nguyễn Thị Phương', g: 'female', f: 'c3', m: 'c3v', o: 2, b: '1950' },
  { key: 'e1', name: 'Nguyễn Văn Quang', g: 'male', f: 'd1', m: 'd1v', o: 1, b: '1968' },
  { key: 'e2', name: 'Nguyễn Thị Quỳnh', g: 'female', f: 'd1', m: 'd1v', o: 2, b: '1972' },
  { key: 'e3', name: 'Nguyễn Văn Sơn', g: 'male', f: 'd3', m: 'd3v', o: 1, b: '1975' },
  { key: 'e4', name: 'Nguyễn Văn Tâm', g: 'male', f: 'd3', m: 'd3v', o: 2, b: '1979' },
];

const ids = new Map<string, number>();
for (const p of people) {
  const r = await db.run(
    `INSERT INTO members (full_name, alias, gender, father_id, mother_id, birth_order, is_blood, is_deceased, birth_date,
     death_date, death_lunar_day, death_lunar_month, branch, bio, generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.alias, p.g, p.f ? ids.get(p.f) : null, p.m ? ids.get(p.m) : null, p.o, p.blood ?? 1, p.d ? 1 : 0, p.b, p.d,
      p.gio?.[0], p.gio?.[1], p.branch, p.bio, 1],
  );
  ids.set(p.key, r.lastId);
  if (p.spouse) {
    const other = ids.get(p.spouse)!;
    const [h, w] = p.g === 'male' ? [r.lastId, other] : [other, r.lastId];
    await db.run('INSERT INTO marriages (husband_id, wife_id, order_no) VALUES (?, ?, 1)', [h, w]);
  }
}
await recomputeGenerations(db);

const cat = async (slug: string) => (await db.first<{ id: number }>('SELECT id FROM categories WHERE slug = ?', [slug]))!.id;
await db.run('INSERT INTO articles (category_id, slug, title, summary, content) VALUES (?, ?, ?, ?, ?)', [
  await cat('pha-ky'), 'loi-noi-dau', 'Lời nói đầu', 'Vì sao con cháu cần biết nguồn cội.',
  '## Lời nói đầu\n\nCây có cội, nước có nguồn. Cuốn gia phả này ghi lại thế thứ của dòng họ từ đời Thủy tổ đến nay.\n\nMọi bổ sung, đính chính xin gửi về ban liên lạc dòng họ.',
]);
await db.run('INSERT INTO articles (category_id, slug, title, summary, content) VALUES (?, ?, ?, ?, ?)', [
  await cat('lich-su'), 'lich-su-nha-tho-ho', 'Lịch sử nhà thờ họ', 'Nhà thờ họ được dựng năm 1902, trùng tu năm 2010.',
  '## Nhà thờ họ\n\nNhà thờ được cụ Nguyễn Văn An khởi dựng năm 1902.\n\n- 1902: khởi dựng\n- 1958: tu sửa mái\n- 2010: trùng tu toàn bộ',
]);
await db.run("INSERT INTO events (title, description, calendar, day, month, recurring, location) VALUES (?, ?, 'lunar', 10, 3, 1, ?)", [
  'Lễ tế Thủy tổ', 'Con cháu các chi tề tựu về nhà thờ họ.', 'Nhà thờ họ',
]);
await db.run("INSERT INTO events (title, description, calendar, day, month, recurring, location) VALUES (?, ?, 'lunar', 15, 1, 1, ?)", [
  'Họp họ đầu xuân', 'Tổng kết năm cũ, khen thưởng con cháu học giỏi.', 'Nhà thờ họ',
]);
await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', 'Gia phả họ Nguyễn')");
await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('viewer_passcode_hash', ?)", [await hashPassword('1234')]);
const admin = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM admins');
if (!admin?.n)
  await db.run('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)', [
    'admin', await hashPassword('giapha123'), 'Quản trị',
  ]);
console.log(`Seed xong: ${people.length} thành viên. Admin: admin / giapha123. Mã xem phả đồ: 1234`);
