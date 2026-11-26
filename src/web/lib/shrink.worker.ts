// Thu nhỏ ảnh trong một luồng riêng, để trang không bị khựng khi người dùng chọn nhiều ảnh lớn.
import { fitScale } from './imageFit.ts';

type Job = { id: number; file: File; quality: number };

async function shrink(file: File, quality: number): Promise<{ blob: Blob; ext: string } | null> {
  const bmp = await createImageBitmap(file);
  const scale = fitScale(bmp.width, bmp.height);
  // Ảnh từ 1080p trở xuống: giữ nguyên file gốc
  if (scale === 1) { bmp.close(); return null; }
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  // WebP nhẹ hơn JPEG khoảng một phần ba ở cùng chất lượng. Trình duyệt không mã hóa được WebP sẽ trả về kiểu khác, khi đó dùng JPEG.
  let blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  let ext = '.webp';
  if (blob.type !== 'image/webp') { blob = await canvas.convertToBlob({ type: 'image/jpeg', quality }); ext = '.jpg'; }
  return blob.size < file.size ? { blob, ext } : null;
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, file, quality } = e.data;
  try {
    const out = await shrink(file, quality);
    (self as any).postMessage({ id, ok: true, blob: out?.blob ?? null, ext: out?.ext ?? '' });
  } catch {
    (self as any).postMessage({ id, ok: false });
  }
};
