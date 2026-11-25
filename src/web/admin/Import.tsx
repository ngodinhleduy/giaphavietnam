import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.ts';
import {
  EXPORT_COLUMNS, IMPORT_FIELDS, buildPlan, exportRows, guessMapping, parseCsv,
  type Cell, type Existing, type ImportField, type ImportPlan, type Mapping, type Note,
} from '../../shared/import.ts';
import { Button, Checkbox, Modal, Select, Spinner, cx } from '../components/ui.tsx';

const CHUNK = 20; // mỗi lô nhỏ để nằm trong giới hạn truy vấn của Cloudflare
const today = () => new Date().toISOString().slice(0, 10);

async function saveXlsx(rows: (string | number)[][], name: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const head = EXPORT_COLUMNS.map((value) => ({ value, fontWeight: 'bold' as const }));
  const width = (i: number) => ([1, 14, 15, 16, 17].includes(i) ? 24 : i === 2 || i === 11 ? 18 : 12);
  await writeXlsxFile([head, ...rows], { columns: EXPORT_COLUMNS.map((_, i) => ({ width: width(i) })), stickyRowsCount: 1 }).toFile(name);
}

/** Xuất toàn bộ thành viên ra Excel. File này nhập lại được. */
export async function exportExcel() {
  const d = await api.get<{ members: any[]; marriages: any[] }>('/admin/members/export');
  await saveXlsx(exportRows(d.members, d.marriages), `gia-pha-${today()}.xlsx`);
  return d.members.length;
}

export const downloadTemplate = () =>
  saveXlsx([
    [1, 'Ngô Văn A', '', 'Nam', 1, '', '', '2', 1, '1850', '12/03/1920', '14/2', 'Có', 'Có', '', 'Quảng Nam', '', '', 'Thủy tổ', '', ''],
    [2, 'Nguyễn Thị B', '', 'Nữ', 1, '', '', '', '', '1855', '', '', 'Có', 'Dâu/rể', '', '', '', '', '', '', ''],
    [3, 'Ngô Văn C', '', 'Nam', 2, 1, 2, '', 1, '05/09/1880', '', '', '', 'Có', 'Chi 1', '', '', '', '', '', ''],
  ], 'mau-nhap-gia-pha.xlsx');

type Sheet = { name: string; header: Cell[]; rows: Cell[][]; firstLine: number };

async function readFile(file: File): Promise<Sheet> {
  let all: Cell[][];
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') all = parseCsv(await file.text());
  else if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    all = (await readSheet(file)) as Cell[][];
  } else throw new Error('Chỉ nhận file .xlsx hoặc .csv. File .xls đời cũ cần lưu lại thành .xlsx trong Excel.');
  // Dòng tiêu đề: trong 10 dòng đầu, dòng nào khớp nhiều tên cột nhất
  let at = -1;
  let best = 0;
  all.slice(0, 10).forEach((r, i) => {
    const n = Object.keys(guessMapping(r)).length;
    if (n > best) { best = n; at = i; }
  });
  if (at < 0) at = all.findIndex((r) => r.some((c) => c != null && String(c).trim()));
  if (at < 0 || all.length - at < 2) throw new Error('File không có dòng dữ liệu nào.');
  return { name: file.name, header: all[at], rows: all.slice(at + 1), firstLine: at + 2 };
}

type Step = 'file' | 'review' | 'run' | 'done' | 'failed';

export function ImportDialog({ open, existing, onClose, onDone }: {
  open: boolean; existing: Existing[]; onClose: () => void; onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('file');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<Mapping>({});
  const [skip, setSkip] = useState(false);
  const [err, setErr] = useState('');
  const [reading, setReading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0, pairs: 0 });

  const plan: ImportPlan | null = useMemo(
    () => (sheet && map.full_name != null ? buildPlan(sheet.rows, map, existing, { skipErrors: skip, firstLine: sheet.firstLine }) : null),
    [sheet, map, existing, skip],
  );
  const reset = () => { setStep('file'); setSheet(null); setMap({}); setSkip(false); setErr(''); };
  const close = () => { if (step === 'run') return; if (step === 'done' || step === 'failed') onDone(); reset(); onClose(); };

  const pick = async (file?: File) => {
    if (!file) return;
    setErr(''); setReading(true);
    try {
      const s = await readFile(file);
      setSheet(s); setMap(guessMapping(s.header)); setSkip(false); setStep('review');
    } catch (e: any) { setErr(e.message ?? 'Không đọc được file.'); } finally { setReading(false); }
  };

  const run = async () => {
    if (!plan) return;
    setStep('run'); setErr('');
    const known: Record<string, number> = { ...plan.known };
    let done = 0;
    setProg({ done: 0, total: plan.items.length, pairs: 0 });
    try {
      for (let i = 0; i < plan.items.length; i += CHUNK) {
        const rows = plan.items.slice(i, i + CHUNK);
        const need: Record<string, number> = {};
        for (const r of rows) for (const p of [r.father_ref, r.mother_ref]) if (p && known[p]) need[p] = known[p];
        const res = await api.post<{ ids: Record<string, number> }>('/admin/members/import', { rows, known: need });
        Object.assign(known, res.ids);
        done += rows.length;
        setProg((p) => ({ ...p, done }));
      }
      const pairs = plan.pairs.filter((p) => known[p.a] && known[p.b]).map((p) => ({ a: known[p.a], b: known[p.b], order_no: p.order_no }));
      let added = 0;
      for (let i = 0; i < pairs.length; i += CHUNK) {
        added += (await api.post<{ added: number }>('/admin/marriages/import', { pairs: pairs.slice(i, i + CHUNK) })).added;
        setProg((p) => ({ ...p, pairs: added }));
      }
      await api.post('/admin/recompute-generations').catch(() => {});
      setStep('done');
    } catch (e: any) {
      setErr(e.message ?? 'Lỗi khi nhập.');
      setProg((p) => ({ ...p, done }));
      setStep('failed');
    }
  };

  const mapped = Object.keys(map).length;
  const colField = (i: number) => (Object.entries(map).find(([, c]) => c === i)?.[0] ?? '') as ImportField | '';
  const setCol = (i: number, f: ImportField | '') => setMap((m) => {
    const next: Mapping = {};
    for (const [k, c] of Object.entries(m) as [ImportField, number][]) if (c !== i && k !== f) next[k] = c;
    if (f) next[f] = i;
    return next;
  });

  return (
    <Modal open={open} onClose={close} title="Nhập thành viên từ Excel" width="max-w-3xl"
      footer={
        step === 'file' ? <Button onClick={close}>Đóng</Button>
        : step === 'review' ? <>
            <Button onClick={reset}>Chọn file khác</Button>
            <Button variant="primary" disabled={!plan?.items.length || (!!plan.errors.length && !skip)} onClick={run}>
              Nhập {plan?.items.length ?? 0} người
            </Button>
          </>
        : step === 'run' ? <Button disabled>Đang nhập...</Button>
        : <>
            <Link to="/admin/tree" onClick={close} className="h-10 px-4 inline-flex items-center rounded-lg border border-line-strong bg-surface font-medium hover:bg-sunken">Xem phả đồ</Link>
            <Button variant="primary" onClick={close}>Xong</Button>
          </>
      }>
      {step === 'file' && (
        <div className="space-y-4">
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            className={cx('flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-10 px-4 text-center cursor-pointer focus-within:ring-2 focus-within:ring-accent',
              drag ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-sunken')}>
            {reading ? <><Spinner /><span className="text-ink-2">Đang đọc file...</span></> : <>
              <span className="font-medium">Chọn file .xlsx hoặc .csv</span>
              <span className="text-sm text-ink-2 pointer-coarse:hidden">Hoặc kéo thả file vào đây</span>
            </>}
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
              disabled={reading} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <div className="text-sm text-ink-2 space-y-2">
            <p>Mỗi dòng là một người. Bắt buộc có cột <b className="text-ink">Họ tên</b> và <b className="text-ink">Giới tính</b>. Tên cột được nhận tự động, bạn sửa lại được ở bước sau.</p>
            <p>Để nối cha mẹ và vợ chồng chính xác, dùng cột <b className="text-ink">Mã</b> cho mỗi người, rồi ghi mã đó vào <b className="text-ink">Mã cha</b>, <b className="text-ink">Mã mẹ</b>, <b className="text-ink">Mã vợ/chồng</b>. Nếu file chỉ có tên cha mẹ, hệ thống nối theo tên và báo những chỗ trùng tên.</p>
            <p>Chưa có gì được lưu cho tới khi bạn bấm Nhập ở bước xem trước.</p>
          </div>
          <Button onClick={() => downloadTemplate().catch((e) => setErr(e.message))}>Tải file mẫu</Button>
        </div>
      )}

      {step === 'review' && sheet && (
        <div className="space-y-4">
          <p className="text-sm text-ink-2 break-all">{sheet.name} · {sheet.rows.length} dòng dữ liệu · nhận được {mapped}/{sheet.header.length} cột</p>
          {map.full_name == null ? (
            <p role="alert" className="rounded-lg bg-danger-soft text-danger px-3 py-2 text-sm">Chưa biết cột nào là Họ tên. Mở phần Ghép cột bên dưới và chọn.</p>
          ) : plan && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Sẽ nhập', `${plan.items.length} người`], ['Hôn nhân', `${plan.pairs.length} cặp`], ['Số đời', String(plan.generations)],
                ['Dòng lỗi', String(new Set(plan.errors.map((e) => e.line)).size)]].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line px-3 py-2">
                  <dt className="text-sm text-ink-2">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {!!plan?.errors.length && (
            <section aria-label="Dòng lỗi">
              <Notes title={`${plan.errors.length} lỗi cần sửa trong file`} list={plan.errors} tone="danger" open />
              <div className="mt-2">
                <Checkbox label={`Bỏ qua ${new Set(plan.errors.map((e) => e.line)).size} dòng lỗi và nhập phần còn lại`} checked={skip} onChange={setSkip} />
                {skip && <p className="mt-1 text-sm text-ink-2">Con của người bị bỏ qua sẽ không còn nối với cha mẹ đó.</p>}
              </div>
            </section>
          )}
          {!!plan?.warnings.length && <Notes title={`${plan.warnings.length} điểm cần lưu ý, vẫn nhập được`} list={plan.warnings} tone="warn" />}

          <details className="rounded-lg border border-line" open={map.full_name == null}>
            <summary className="px-3 min-h-11 flex items-center cursor-pointer font-medium">Ghép cột</summary>
            <ul className="border-t border-line divide-y divide-line">
              {sheet.header.map((h, i) => (
                <li key={i} className="grid grid-cols-[1fr_11rem] sm:grid-cols-[1fr_1fr_13rem] items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium truncate">{String(h ?? '') || `Cột ${i + 1}`}</span>
                  <span className="hidden sm:block text-ink-2 truncate">{String(sheet.rows.find((r) => r[i] != null && String(r[i]).trim())?.[i] ?? '')}</span>
                  <Select aria-label={`Cột ${String(h ?? i + 1)} là`} value={colField(i)} onChange={(e) => setCol(i, e.target.value as ImportField | '')}>
                    <option value="">Bỏ qua cột này</option>
                    {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </Select>
                </li>
              ))}
            </ul>
          </details>

          {!!plan?.items.length && (
            <details className="rounded-lg border border-line">
              <summary className="px-3 min-h-11 flex items-center cursor-pointer font-medium">Xem trước {Math.min(plan.items.length, 12)} người đầu</summary>
              <div className="border-t border-line overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-ink-2"><tr>{['Họ tên', 'Giới tính', 'Đời', 'Cha', 'Mẹ', 'Loại'].map((h) => <th key={h} className="font-medium px-3 h-9 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {plan.items.slice(0, 12).map((it) => {
                      const nameOf = (ref: string | null) => !ref ? '' : ref.startsWith('db:')
                        ? `${existing.find((e) => e.id === plan.known[ref])?.full_name ?? ''} (đã có)` : plan.items.find((x) => x.ref === ref)?.full_name ?? '';
                      return (
                        <tr key={it.ref}>
                          <td className="px-3 py-1.5 whitespace-nowrap">{it.full_name}</td>
                          <td className="px-3">{it.gender === 'male' ? 'Nam' : 'Nữ'}</td>
                          <td className="px-3 tabular-nums">{it.generation}</td>
                          <td className="px-3 whitespace-nowrap">{nameOf(it.father_ref)}</td>
                          <td className="px-3 whitespace-nowrap">{nameOf(it.mother_ref)}</td>
                          <td className="px-3 whitespace-nowrap">{it.is_blood ? 'Trong họ' : 'Dâu, rể'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {step === 'run' && (
        <div className="py-6" role="status">
          <p className="font-medium">Đang nhập {prog.done}/{prog.total} người</p>
          <div className="mt-3 h-2 rounded-full bg-sunken overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
          </div>
          <p className="mt-3 text-sm text-ink-2">Giữ nguyên trang này cho tới khi xong.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="py-4" role="status">
          <p className="font-semibold text-lg">Đã nhập {prog.done} người và {prog.pairs} quan hệ hôn nhân.</p>
          <p className="mt-2 text-ink-2">Mở phả đồ để kiểm tra cây. Ảnh chân dung và tiểu sử dài bổ sung sau ở hồ sơ từng người.</p>
        </div>
      )}

      {step === 'failed' && (
        <div className="py-4" role="alert">
          <p className="font-semibold text-lg text-danger">Việc nhập dừng giữa chừng</p>
          <p className="mt-2">{err}</p>
          <p className="mt-2 text-ink-2">Đã lưu được {prog.done}/{prog.total} người trước khi lỗi. Đừng nhập lại nguyên file này vì sẽ trùng {prog.done} người đầu. Hãy xóa các dòng đã nhập khỏi file, hoặc xóa những người vừa nhập rồi làm lại.</p>
        </div>
      )}
    </Modal>
  );
}

function Notes({ title, list, tone, open }: { title: string; list: Note[]; tone: 'danger' | 'warn'; open?: boolean }) {
  const MAX = 60;
  return (
    <details open={open} className={cx('rounded-lg border', tone === 'danger' ? 'border-danger/40 bg-danger-soft' : 'border-line bg-sunken')}>
      <summary className={cx('px-3 min-h-11 flex items-center cursor-pointer font-medium', tone === 'danger' && 'text-danger')}>{title}</summary>
      <ul className="px-3 pb-3 text-sm space-y-1 max-h-56 overflow-y-auto">
        {list.slice(0, MAX).map((n, i) => (
          <li key={i}><span className="tabular-nums text-ink-2">Dòng {n.line}</span> · <b className="font-medium">{n.name}</b>: {n.text}</li>
        ))}
        {list.length > MAX && <li className="text-ink-2">Và {list.length - MAX} mục khác.</li>}
      </ul>
    </details>
  );
}
