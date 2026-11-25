import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx, Input, Select } from './ui.tsx';
import { solarToLunar, formatLunar } from '../../shared/lunar.ts';

/**
 * Ô nhập ngày cho gia phả. Giá trị lưu: '' | 'YYYY' | 'YYYY-MM-DD'.
 * - Gõ tay: 1950, 21/3/1950, 21-03-1950
 * - Hoặc chọn trên lịch, có chọn nhanh tháng và năm (từ 1600)
 * - Chế độ "Chỉ biết năm" cho người không rõ ngày sinh/mất
 */
const MIN_YEAR = 1600;
export const LUNAR_MONTHS = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười một', 'Chạp'];
const WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const pad = (n: number) => String(n).padStart(2, '0');
const isFull = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function displayDate(v: string) {
  if (!v) return '';
  if (isFull(v)) {
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  }
  return v.slice(0, 4);
}

/** Đọc chuỗi người dùng gõ. Trả về giá trị chuẩn hoặc null nếu sai. */
export function parseDate(text: string): string | null {
  const t = text.trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})$/);
  if (m) return validYear(+m[1]) ? m[1] : null;
  m = t.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/);
  if (m) return build(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return build(+m[1], +m[2], +m[3]);
  return null;
}
const validYear = (y: number) => y >= MIN_YEAR && y <= new Date().getFullYear() + 1;
function build(y: number, mo: number, d: number) {
  if (!validYear(y) || mo < 1 || mo > 12) return null;
  const last = new Date(y, mo, 0).getDate();
  if (d < 1 || d > last) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function DateInput({ id, value, onChange, showLunar, placeholder = 'dd/mm/yyyy hoặc năm', max, ariaInvalid }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** Hiện ngày âm lịch tương ứng bên dưới */
  showLunar?: boolean;
  placeholder?: string;
  /** Không cho chọn sau ngày này (YYYY-MM-DD) */
  max?: string;
  ariaInvalid?: boolean;
}) {
  const [text, setText] = useState(displayDate(value));
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const popId = useId();
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(displayDate(value)); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const commit = (t: string) => {
    const v = parseDate(t);
    if (v === null) { setErr('Ngày không hợp lệ. Gõ dạng 21/03/1950 hoặc chỉ năm 1950.'); return; }
    if (v && max && isFull(v) && v > max) { setErr('Ngày này ở tương lai.'); return; }
    setErr('');
    onChange(v);
    setText(displayDate(v));
  };

  const lunar = showLunar && isFull(value)
    ? (() => { const [y, m, d] = value.split('-').map(Number); return formatLunar(solarToLunar(d, m, y)); })()
    : '';

  return (
    <div ref={wrap} className="relative">
      <div className="relative">
        <Input id={id} value={text} placeholder={placeholder} inputMode="numeric" autoComplete="off"
          aria-invalid={ariaInvalid || !!err} aria-describedby={err ? `${popId}-err` : undefined}
          className="w-full pr-11"
          onFocus={() => { focused.current = true; }}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            if (err) setErr('');
            // Gõ xong một giá trị hợp lệ thì ghi nhận ngay, không chờ rời ô
            const v = parseDate(t);
            if (v !== null && v !== '' && !(max && isFull(v) && v > max)) onChange(v);
            else if (t.trim() === '') onChange('');
          }}
          onBlur={() => { focused.current = false; commit(text); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(text); } if (e.key === 'ArrowDown' && e.altKey) setOpen(true); }} />
        <button type="button" aria-label="Mở lịch" aria-expanded={open} aria-controls={popId} onClick={() => setOpen((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-9 inline-flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-sunken cursor-pointer">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" /></svg>
        </button>
      </div>
      {err ? <p id={`${popId}-err`} role="alert" className="mt-1.5 text-sm text-danger">{err}</p>
        : lunar ? <p className="mt-1.5 text-sm text-ink-3">Âm lịch: {lunar}</p> : null}
      {open && (
        <Calendar id={popId} value={value} max={max}
          onPick={(v) => { focused.current = false; onChange(v); setText(displayDate(v)); setErr(''); setOpen(false); }} />
      )}
    </div>
  );
}

function Calendar({ id, value, onPick, max }: { id: string; value: string; onPick: (v: string) => void; max?: string }) {
  const today = new Date();
  const init = value ? { y: +value.slice(0, 4), m: isFull(value) ? +value.slice(5, 7) : 1 } : { y: today.getFullYear(), m: today.getMonth() + 1 };
  const [y, setY] = useState(init.y);
  const [m, setM] = useState(init.m);
  const [yearText, setYearText] = useState(String(init.y));
  useEffect(() => setYearText(String(y)), [y]);
  const maxY = today.getFullYear() + 1;
  const days = useMemo(() => {
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7; // tuần bắt đầu thứ hai
    const count = new Date(y, m, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [y, m]);
  const step = (d: number) => {
    let nm = m + d;
    let ny = y;
    if (nm < 1) { nm = 12; ny--; }
    if (nm > 12) { nm = 1; ny++; }
    if (ny < MIN_YEAR || ny > maxY) return;
    setM(nm);
    setY(ny);
  };
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return (
    <div id={id} role="dialog" aria-label="Chọn ngày"
      className="absolute z-40 mt-1 left-0 w-[19.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface shadow-xl p-3">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => step(-1)} aria-label="Tháng trước" className="size-9 shrink-0 rounded-md hover:bg-sunken cursor-pointer">‹</button>
        <Select aria-label="Tháng" value={m} onChange={(e) => setM(+e.target.value)} className="flex-1 w-auto h-9 pointer-coarse:h-10 text-sm">
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
        </Select>
        <Input aria-label="Năm" inputMode="numeric" value={yearText} className="w-[4.75rem] h-9 pointer-coarse:h-10 text-sm text-center px-1"
          onChange={(e) => {
            setYearText(e.target.value);
            const n = +e.target.value;
            if (/^\d{4}$/.test(e.target.value) && n >= MIN_YEAR && n <= maxY) setY(n);
          }} />
        <button type="button" onClick={() => step(1)} aria-label="Tháng sau" className="size-9 shrink-0 rounded-md hover:bg-sunken cursor-pointer">›</button>
      </div>
      <div className="grid grid-cols-7 mt-2 text-center text-xs text-ink-3">
        {WEEK.map((w) => <span key={w} className="h-8 inline-flex items-center justify-center">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {days.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const iso = `${y}-${pad(m)}-${pad(d)}`;
          const sel = iso === value;
          const disabled = !!max && iso > max;
          return (
            <button key={iso} type="button" disabled={disabled} onClick={() => onPick(iso)} aria-label={`${d}/${m}/${y}`} aria-pressed={sel}
              className={cx('h-9 pointer-coarse:h-10 rounded-md text-sm tabular-nums cursor-pointer disabled:text-line-strong disabled:cursor-not-allowed',
                sel ? 'bg-accent text-white font-semibold' : iso === todayIso ? 'ring-1 ring-inset ring-accent text-accent' : 'hover:bg-sunken text-ink')}>
              {d}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-line">
        <button type="button" onClick={() => onPick(String(y))} className="h-9 px-2 rounded-md text-sm font-medium text-accent hover:bg-accent-soft cursor-pointer">
          Chỉ biết năm {y}
        </button>
        <button type="button" onClick={() => onPick('')} className="h-9 px-2 rounded-md text-sm text-ink-2 hover:bg-sunken cursor-pointer">Xóa</button>
      </div>
    </div>
  );
}

/** Chọn ngày, tháng âm lịch (dùng cho ngày giỗ, lễ lặp hằng năm). */
export function LunarDayMonth({ id, day, month, onChange }: {
  id?: string; day: string; month: string; onChange: (day: string, month: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select id={id} aria-label="Ngày" value={day} onChange={(e) => onChange(e.target.value, month)} className="w-auto flex-1 sm:flex-none sm:w-28">
        <option value="">Ngày</option>
        {Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>{i < 10 ? `Mùng ${i + 1}` : i + 1}</option>)}
      </Select>
            <Select aria-label="Tháng" value={month} onChange={(e) => onChange(day, e.target.value)} className="w-auto flex-1 sm:flex-none sm:w-32">
        <option value="">Tháng</option>
        {LUNAR_MONTHS.map((n, i) => <option key={i} value={i + 1}>Tháng {n}</option>)}
      </Select>
    </div>
  );
}
