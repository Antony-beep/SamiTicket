import 'server-only';
import sharp from 'sharp';
import { AppError } from '@/lib/validation';

export const maxUploadBytes = 8 * 1024 * 1024;
export const coverBudgets = { small: { edge: 640, target: 150000, max: 180000 }, large: { edge: 1600, target: 300000, max: 360000 } };
function hasAnimation(input: Buffer, format: string) {
  // libvips may read APNG as a single PNG page; inspect chunk types, never compressed bytes.
  let offset = format === 'png' ? 8 : 12;
  while (offset + (format === 'png' ? 12 : 8) <= input.length) {
    const length = format === 'png' ? input.readUInt32BE(offset) : input.readUInt32LE(offset + 4);
    const type = input.toString('ascii', offset + (format === 'png' ? 4 : 0), offset + (format === 'png' ? 8 : 4));
    if (type === 'acTL' || type === 'ANIM' || type === 'ANMF') return true;
    offset += length + (format === 'png' ? 12 : 8 + length % 2);
  }
  return false;
}
export async function convertCover(input: Buffer) {
  if (!input.length || input.length > maxUploadBytes) throw new AppError('La imagen debe pesar hasta 8 MiB.', 413, { cover: 'La imagen debe pesar hasta 8 MiB.' });
  try {
    const metadata = await sharp(input, { limitInputPixels: 32000000, animated: true, failOn: 'warning' }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > 32000000) throw new Error('unsupported');
    if ((metadata.format === 'png' || metadata.format === 'webp') && hasAnimation(input, metadata.format)) throw new Error('animated');
    const variants = {} as Record<'small' | 'large', Buffer>;
    for (const size of ['small', 'large'] as const) {
      const budget = coverBudgets[size];
      let result: Buffer | undefined;
      for (const quality of [82, 78, 74, 70]) {
        result = await sharp(input, { limitInputPixels: 32000000, failOn: 'warning' }).rotate()
          .resize({ width: budget.edge, height: budget.edge, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
        if (result.length <= budget.target) break;
      }
      if (!result || result.length > budget.max) throw new AppError('El afiche excede el peso máximo sin bajar de calidad 70. Usa una imagen más sencilla.', 422, { cover: 'No se pudo optimizar este afiche. La portada anterior se conserva.' });
      variants[size] = result;
    }
    return variants;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Usa un JPEG, PNG o WebP estático válido, de hasta 32 megapíxeles.', 422, { cover: 'Imagen corrupta, animada o formato no admitido.' });
  }
}
