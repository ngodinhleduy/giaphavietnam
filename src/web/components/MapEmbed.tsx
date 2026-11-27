import { useEffect, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { cleanMapInput, mapEmbedUrl, mapOpenUrl } from '../../shared/map.ts';
import { Field, Textarea, cx } from './ui.tsx';

/** Bản đồ nhúng kèm nút mở trong Google Maps. Không có gì để hiện thì không vẽ gì. */
export function MapView({ value, address, title, className, height = 'h-64' }: {
  value?: string | null; address?: string | null; title: string; className?: string; height?: string;
}) {
  const src = mapEmbedUrl(value, address);
  const open = mapOpenUrl(value, address);
  if (!src && !open) return null;
  return (
    <div className={cx('overflow-hidden rounded-xl border border-line bg-surface', className)}>
      {src && <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className={cx('block w-full border-0', height)} />}
      {open && (
        <a href={open} target="_blank" rel="noopener noreferrer"
          className={cx('flex items-center gap-2 min-h-11 px-3 text-sm font-medium text-accent hover:bg-accent-soft transition-colors', src && 'border-t border-line')}>
          <MapPin aria-hidden className="size-4 shrink-0" />
          <span className="flex-1">Mở trong Google Maps</span>
          <ExternalLink aria-hidden className="size-4 shrink-0" /><span className="sr-only"> (mở tab mới)</span>
        </a>
      )}
    </div>
  );
}

/** Ô dán vị trí Google Maps kèm bản xem trước. */
export function MapField({ id, label = 'Vị trí trên Google Maps', value, onChange, address, previewTitle }: {
  id: string; label?: string; value: string; onChange: (v: string) => void;
  /** Địa chỉ gõ tay ở ô bên cạnh: dùng để vẽ bản đồ khi ô này trống hoặc là đường dẫn rút gọn */
  address?: string; previewTitle: string;
}) {
  // Bản xem trước đi sau ô nhập nửa giây, để không tải lại bản đồ theo từng ký tự
  const [shown, setShown] = useState({ value, address });
  useEffect(() => {
    const t = setTimeout(() => setShown({ value, address }), 500);
    return () => clearTimeout(t);
  }, [value, address]);
  const hasPreview = !!(mapEmbedUrl(shown.value, shown.address) || mapOpenUrl(shown.value, shown.address));
  const short = /goo\.gl/i.test(value);
  return (
    <div className="grid gap-3">
      <Field label={label} htmlFor={id} optional
        hint={short && !address?.trim()
          ? 'Đường dẫn rút gọn không hiện được bản đồ ở đây. Hãy điền thêm địa chỉ, hoặc dán mã từ Chia sẻ, Nhúng bản đồ.'
          : 'Dán đường dẫn Google Maps, hoặc mã lấy từ Chia sẻ, Nhúng bản đồ, Sao chép HTML.'}>
        <Textarea id={id} rows={2} className="font-mono text-sm" value={value} placeholder="https://www.google.com/maps/..."
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { const v = cleanMapInput(value); if (v !== value) onChange(v); }} />
      </Field>
      {hasPreview
        ? <MapView value={shown.value} address={shown.address} title={previewTitle} height="h-48" />
        : <p className="flex items-center justify-center gap-2 h-24 rounded-xl border border-dashed border-line-strong text-sm text-ink-2"><MapPin aria-hidden className="size-4" />Bản đồ xem trước hiện ở đây sau khi bạn điền địa chỉ hoặc vị trí.</p>}
    </div>
  );
}
