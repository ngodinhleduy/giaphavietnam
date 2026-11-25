import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { fileUrl } from '../lib/api.ts';
import { initials } from '../lib/format.ts';
import { fold } from '../../shared/slug.ts';
import type { MemberBrief } from '../lib/types.ts';

export const cx = (...c: (string | false | null | undefined | 0)[]) => c.filter(Boolean).join(' ');

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:bg-line-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3',
  danger: 'bg-surface text-danger border border-line-strong hover:bg-danger-soft hover:border-danger',
};
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[15px]',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Form ----------
export function Field({ label, hint, error, children, className, htmlFor }: {
  label: string; hint?: string; error?: string; children: ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-ink-3">{hint}</p> : null}
    </div>
  );
}

const withW = (c?: string) => (c && /(^|\s)(sm:|md:)?w-/.test(c) ? c : cx('w-full', c));
const inputCls =
  'h-10 rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-sunken';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p }, ref,
) {
  return <input ref={ref} className={cx(inputCls, withW(className))} {...p} />;
});
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, 'h-auto min-h-24 py-2 leading-relaxed', withW(className))} {...p} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'pr-8 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2020%2020%27%20fill=%27%2357534e%27%3E%3Cpath%20d=%27M5.5%207.5l4.5%204.5%204.5-4.5%27%20stroke=%27%2357534e%27%20stroke-width=%271.5%27%20fill=%27none%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_10px_center] bg-no-repeat', withW(className))} {...p}>
      {children}
    </select>
  );
}
export function Checkbox({ label, checked, onChange, id }: { label: string; checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  const uid = useId();
  return (
    <label htmlFor={id ?? uid} className="inline-flex items-center gap-2 text-[15px] text-ink cursor-pointer select-none min-h-10">
      <input id={id ?? uid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

// ---------- Feedback ----------
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 border border-dashed border-line-strong rounded-xl bg-surface">
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="mt-1 text-sm text-ink-2 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: { message: string } | string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
      <span className="flex-1">{typeof error === 'string' ? error : error.message}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}
export function Loading({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-2" role="status">
      <Spinner /> <span>{label}</span>
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-sunken', className)} />;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'gold' | 'success' }) {
  const t = {
    neutral: 'bg-sunken text-ink-2',
    accent: 'bg-accent-soft text-accent',
    gold: 'bg-gold-soft text-gold',
    success: 'bg-success-soft text-success',
  }[tone];
  return <span className={cx('inline-flex items-center h-6 px-2 rounded-md text-xs font-medium', t)}>{children}</span>;
}

// ---------- Avatar ----------
export function Avatar({ m, size = 48 }: { m: Pick<MemberBrief, 'full_name' | 'gender' | 'photo_file_id' | 'is_deceased'>; size?: number }) {
  const [broken, setBroken] = useState(false);
  const ring = m.gender === 'male' ? 'ring-male/30' : 'ring-female/30';
  if (m.photo_file_id && !broken)
    return (
      <img src={fileUrl(m.photo_file_id)} alt="" width={size} height={size} onError={() => setBroken(true)}
        className={cx('rounded-full object-cover ring-2 shrink-0', ring, !!m.is_deceased && 'grayscale')}
        style={{ width: size, height: size }} />
    );
  return (
    <span aria-hidden
      className={cx('inline-flex items-center justify-center rounded-full ring-2 shrink-0 font-serif font-semibold',
        ring, m.is_deceased ? 'bg-sunken text-ink-2' : m.gender === 'male' ? 'bg-[#e8eef7] text-male' : 'bg-[#f7e9ef] text-female')}
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(m.full_name)}
    </span>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-6" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cx('w-full bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col', width)}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="size-9 inline-flex items-center justify-center rounded-lg text-ink-2 hover:bg-sunken cursor-pointer">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Confirm + Toast ----------
type ToastItem = { id: number; text: string; tone: 'success' | 'error' };
const ToastCtx = createContext<{ toast: (text: string, tone?: 'success' | 'error') => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx).toast;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3000);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 no-print" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('rounded-lg px-4 py-3 text-sm shadow-lg max-w-sm',
            t.tone === 'success' ? 'bg-ink text-white' : 'bg-danger text-white')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Member picker (combobox tìm theo tên không dấu) ----------
export function MemberPicker({ members, value, onChange, placeholder = 'Gõ tên để tìm...', filter, id, allowClear = true }: {
  members: MemberBrief[]; value: number | null; onChange: (id: number | null) => void; placeholder?: string;
  filter?: (m: MemberBrief) => boolean; id?: string; allowClear?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = members.find((m) => m.id === value) ?? null;
  const results = useMemo(() => {
    const f = fold(q);
    return rankByName(members.filter((m) => !filter || filter(m)), f).slice(0, 40);
  }, [q, members, filter]);
  const pick = (m: MemberBrief | null) => {
    onChange(m?.id ?? null);
    setQ('');
    setOpen(false);
  };
  return (
    <div className="relative">
      <Input id={id} role="combobox" aria-expanded={open} aria-controls={listId} autoComplete="off"
        value={open ? q : selected ? `${selected.full_name}${selected.generation ? ` (đời ${selected.generation})` : ''}` : ''}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active]); }
        }} />
      {selected && allowClear && !open && (
        <button type="button" onClick={() => pick(null)} aria-label="Bỏ chọn"
          className="absolute right-1 top-1 size-8 rounded-md text-ink-3 hover:bg-sunken hover:text-ink cursor-pointer">×</button>
      )}
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-line bg-surface shadow-lg py-1">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">Không có kết quả</li>}
          {results.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
              className={cx('flex items-center gap-2 px-3 py-2 cursor-pointer text-[15px]', i === active && 'bg-sunken')}>
              <Avatar m={m} size={28} />
              <span className="flex-1 truncate">{m.full_name}</span>
              <span className="text-xs text-ink-3">{m.generation ? `Đời ${m.generation}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-[28px] font-semibold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** Lọc + xếp hạng theo tên không dấu: khớp đầu từ xếp trước, khớp giữa từ xếp sau. */
export function rankByName<T extends { full_name: string }>(list: T[], q: string): T[] {
  const f = fold(q).trim();
  if (!f) return list;
  const scored: [T, number][] = [];
  for (const m of list) {
    const name = fold(m.full_name);
    const words = name.split(' ');
    const terms = f.split(' ');
    if (terms.every((t) => words.some((w) => w.startsWith(t)))) scored.push([m, 0]);
    else if (name.includes(f)) scored.push([m, 1]);
  }
  return scored.sort((a, b) => a[1] - b[1]).map(([m]) => m);
}
