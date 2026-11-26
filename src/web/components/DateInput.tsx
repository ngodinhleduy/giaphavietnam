import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx, Input, Select } from './ui.tsx';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dayInfo, formatLunar, lunarToSolar, solarToLunar, type DayInfo } from '../../shared/lunar.ts';

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
          <CalendarDays aria-hidden className="size-5" />
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

/** Đầu lịch: lùi, tiến, chọn tháng, gõ năm. */
function MonthNav({ y, m, set, minY, maxY }: { y: number; m: number; set: (y: number, m: number) => void; minY: number; maxY: number }) {
  const [yearText, setYearText] = useState(String(y));
  useEffect(() => setYearText(String(y)), [y]);
  const step = (d: number) => {
    let nm = m + d;
    let ny = y;
    if (nm < 1) { nm = 12; ny--; }
    if (nm > 12) { nm = 1; ny++; }
    if (ny >= minY && ny <= maxY) set(ny, nm);
  };
  const nav = 'size-9 pointer-coarse:size-10 shrink-0 inline-flex items-center justify-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink transition-colors cursor-pointer';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => step(-1)} aria-label="Tháng trước" className={nav}><ChevronLeft aria-hidden className="size-5" /></button>
      <Select aria-label="Tháng" value={m} onChange={(e) => set(y, +e.target.value)} className="flex-1 w-auto h-9 pointer-coarse:h-10 text-sm">
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
      </Select>
      <Input aria-label="Năm" inputMode="numeric" value={yearText} className="w-[4.75rem] h-9 pointer-coarse:h-10 text-sm text-center px-1"
        onChange={(e) => {
          setYearText(e.target.value);
          const n = +e.target.value;
          if (/^\d{4}$/.test(e.target.value) && n >= minY && n <= maxY) set(n, m);
        }} />
      <button type="button" onClick={() => step(1)} aria-label="Tháng sau" className={nav}><ChevronRight aria-hidden className="size-5" /></button>
    </div>
  );
}

type Cell = { d: number; iso: string; info: DayInfo };
/**
 * Lưới một tháng. Dưới mỗi ngày dương là ngày âm; mùng 1, rằm và ngày lễ tô đỏ.
 * Ngày đầu tháng âm ghi kèm tháng (ví dụ 1/2) để biết đang ở tháng âm nào.
 */
function MonthGrid({ y, m, selected, disabled, onPick, onHover }: {
  y: number; m: number; selected: (c: Cell) => boolean; disabled?: (c: Cell) => boolean;
  onPick: (c: Cell) => void; onHover?: (c: Cell | null) => void;
}) {
  const cells = useMemo(() => {
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // tuần bắt đầu thứ hai
    const count = new Date(y, m, 0).getDate();
    const list: (Cell | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= count; d++) list.push({ d, iso: `${y}-${pad(m)}-${pad(d)}`, info: dayInfo(d, m, y) });
    return list;
  }, [y, m]);
  const t = new Date();
  const todayIso = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  return (
    <>
      <div className="grid grid-cols-7 mt-2 text-center text-xs font-medium text-ink-2" aria-hidden>
        {WEEK.map((w) => <span key={w} className={cx('h-7 inline-flex items-center justify-center', w === 'CN' && 'text-danger')}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => onHover?.(null)}>
        {cells.map((c, i) => {
          if (!c) return <span key={`e${i}`} />;
          const { lunar, mark } = c.info;
          const sel = selected(c);
          const off = disabled?.(c) ?? false;
          return (
            <button key={c.iso} type="button" disabled={off} aria-pressed={sel} title={mark || undefined}
              aria-label={`${c.d}/${m}/${y}, âm lịch ${lunar.day}/${lunar.month}${lunar.leap ? ' nhuận' : ''}${mark ? `, ${mark}` : ''}`}
              onClick={() => onPick(c)} onMouseEnter={() => onHover?.(c)} onFocus={() => onHover?.(c)}
              className={cx('h-11 rounded-md flex flex-col items-center justify-center leading-none tabular-nums cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                sel ? 'bg-accent text-white' : c.iso === todayIso ? 'ring-1 ring-inset ring-accent hover:bg-sunken' : 'hover:bg-sunken',
                !sel && (mark ? 'text-danger' : 'text-ink'))}>
              <span className={cx('text-sm', (sel || mark) && 'font-semibold')}>{c.d}</span>
              <span className={cx('mt-1 text-[11px]', sel ? 'text-white' : mark ? 'text-danger font-medium' : 'text-ink-2')}>
                {lunar.day === 1 ? `1/${lunar.month}` : lunar.day}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Calendar({ id, value, onPick, max }: { id: string; value: string; onPick: (v: string) => void; max?: string }) {
  const today = new Date();
  const init = value ? { y: +value.slice(0, 4), m: isFull(value) ? +value.slice(5, 7) : 1 } : { y: today.getFullYear(), m: today.getMonth() + 1 };
  const [ym, setYm] = useState(init);
  const [hover, setHover] = useState<Cell | null>(null);
  const { y, m } = ym;
  return (
    <div id={id} role="dialog" aria-label="Chọn ngày"
      className="gp-pop absolute z-40 mt-1 left-0 w-[21rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface shadow-xl p-3">
      <MonthNav y={y} m={m} set={(ny, nm) => setYm({ y: ny, m: nm })} minY={MIN_YEAR} maxY={today.getFullYear() + 1} />
      <MonthGrid y={y} m={m} selected={(c) => c.iso === value} disabled={(c) => !!max && c.iso > max} onPick={(c) => onPick(c.iso)} onHover={setHover} />
      <p className="mt-2 h-5 text-xs text-ink-2 truncate" aria-hidden>
        {hover ? <>{formatLunar(hover.info.lunar)}{hover.info.mark && <span className="text-danger font-medium"> · {hover.info.mark}</span>}</> : 'Màu đỏ: mùng 1, rằm, ngày lễ.'}
      </p>
      <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-line">
        <button type="button" onClick={() => onPick(String(y))} className="h-9 px-2 rounded-md text-sm font-medium text-accent hover:bg-accent-soft cursor-pointer">
          Chỉ biết năm {y}
        </button>
        <button type="button" onClick={() => onPick('')} className="h-9 px-2 rounded-md text-sm text-ink-2 hover:bg-sunken cursor-pointer">Xóa</button>
      </div>
    </div>
  );
}

export type EventDate = { calendar: 'lunar' | 'solar'; day: number | null; month: number | null; year: number | null };
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * Chọn ngày cho sự kiện ngay trên lịch tháng. Mỗi ô đã hiện cả ngày dương lẫn ngày âm nên lịch không có nút đổi loại lịch.
 * value.calendar chỉ quyết định sự kiện lặp hằng năm theo ngày âm hay ngày dương; nơi dùng đổi nó bằng convertEventDate.
 */
/** Đổi cách lưu (âm hoặc dương) mà vẫn giữ đúng ô ngày đang chọn trên lịch. */
export function convertEventDate(v: EventDate, cal: 'lunar' | 'solar'): EventDate {
  if (cal === v.calendar) return v;
  if (!v.day || !v.month) return { ...v, calendar: cal };
  const year = v.year || new Date().getFullYear();
  if (cal === 'lunar') { const l = solarToLunar(v.day, v.month, year); return { calendar: 'lunar', day: l.day, month: l.month, year: l.year }; }
  const s = lunarToSolar(v.day, v.month, year);
  return s ? { calendar: 'solar', day: s[0], month: s[1], year: s[2] } : { ...v, calendar: cal };
}

export function EventDatePicker({ value, onChange, recurring, invalid }: {
  value: EventDate; onChange: (v: EventDate) => void; recurring: boolean; invalid?: boolean;
}) {
  const today = new Date();
  const thisYear = today.getFullYear();
  // Ngày dương ứng với lựa chọn hiện tại, trong năm đã lưu hoặc năm nay
  const solarOf = (v: EventDate, year: number): [number, number, number] | null => {
    if (!v.day || !v.month) return null;
    if (v.calendar === 'solar') return [v.day, v.month, year];
    return lunarToSolar(v.day, v.month, year);
  };
  const first = solarOf(value, value.year || thisYear);
  const [ym, setYm] = useState(first ? { y: first[2], m: first[1] } : { y: thisYear, m: today.getMonth() + 1 });
  const [hover, setHover] = useState<Cell | null>(null);
  const { y, m } = ym;
  const lunar = value.calendar === 'lunar';

  const selected = (c: Cell) => {
    if (!value.day || !value.month) return false;
    const l = c.info.lunar;
    const same = lunar ? l.day === value.day && l.month === value.month && !l.leap : c.d === value.day && m === value.month;
    if (!same || recurring || !value.year) return same;
    return lunar ? l.year === value.year : y === value.year;
  };
  const pick = (c: Cell) => {
    const l = c.info.lunar;
    onChange(lunar ? { calendar: 'lunar', day: l.day, month: l.month, year: l.year } : { calendar: 'solar', day: c.d, month: m, year: y });
  };
  const next = solarOf(value, recurring ? y : value.year || y);
  const summary = !value.day || !value.month ? null : lunar
    ? `${value.day < 11 ? `Mùng ${value.day}` : `Ngày ${value.day}`} tháng ${LUNAR_MONTHS[value.month - 1]} âm lịch`
    : `Ngày ${value.day} tháng ${value.month} dương lịch`;
  return (
    <div className={cx('rounded-xl border bg-surface p-3', invalid ? 'border-danger' : 'border-line-strong')}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm text-ink-2">Số nhỏ là ngày âm lịch</p>
        <button type="button" onClick={() => setYm({ y: thisYear, m: today.getMonth() + 1 })}
          className="h-8 pointer-coarse:h-10 px-2.5 rounded-md text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink cursor-pointer transition-colors">Hôm nay</button>
      </div>
      <MonthNav y={y} m={m} set={(ny, nm) => setYm({ y: ny, m: nm })} minY={MIN_YEAR} maxY={thisYear + 50} />
      <MonthGrid y={y} m={m} selected={selected} onPick={pick} onHover={setHover} />
      <p className="mt-2 h-5 text-xs text-ink-2 truncate" aria-hidden>
        {hover ? <>{hover.d}/{m}/{y} · {formatLunar(hover.info.lunar)}{hover.info.mark && <span className="text-danger font-medium"> · {hover.info.mark}</span>}</> : 'Màu đỏ: mùng 1, rằm, ngày lễ.'}
      </p>
      <p role="status" className="mt-1 pt-2.5 border-t border-line text-sm">
        {!summary ? <span className="text-ink-2">Bấm một ngày trên lịch để chọn.</span> : (
          <>
            <span className="font-semibold text-ink">{summary}</span>
            {next && <span className="text-ink-2">{lunar
              ? ` · năm ${next[2]} là ${WEEKDAY[new Date(next[2], next[1] - 1, next[0]).getDay()].toLowerCase()} ${next[0]}/${next[1]}/${next[2]}`
              : ` · ${WEEKDAY[new Date(next[2], next[1] - 1, next[0]).getDay()].toLowerCase()}, âm lịch ${(() => { const l = solarToLunar(next[0], next[1], next[2]); return `${l.day}/${l.month}`; })()}`}</span>}
          </>
        )}
      </p>
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
