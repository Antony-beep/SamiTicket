import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';
import { expect, it } from 'vitest';
import { convertCover, coverBudgets } from '@/lib/server/images';

it('converts a readable poster to two proportional WebPs and strips metadata', async () => {
  const input = await sharp(Buffer.from('<svg width="1200" height="1800"><rect width="1200" height="1800" fill="#174f39"/><text x="80" y="160" font-size="90" fill="white">FIESTA PERÚ</text><text x="80" y="300" font-size="60" fill="white">20:00 · Entrada general</text></svg>')).png().toBuffer();
  const output = await convertCover(input);
  await mkdir('.next/test-artifacts', { recursive: true });
  await Promise.all((['small', 'large'] as const).map(size => writeFile(`.next/test-artifacts/cover-${size}.webp`, output[size])));
  for (const size of ['small', 'large'] as const) {
    const meta = await sharp(output[size]).metadata();
    expect(meta.format).toBe('webp'); expect(output[size].length).toBeLessThanOrEqual(coverBudgets[size].max);
    expect(meta.height).toBe(coverBudgets[size].edge); expect(meta.width! / meta.height!).toBeCloseTo(2 / 3, 2);
    expect(meta.exif).toBeUndefined(); expect(meta.icc).toBeUndefined();
  }
});
it('never enlarges small originals and corrects EXIF orientation', async () => {
  const small = await sharp({ create: { width: 40, height: 60, channels: 3, background: 'red' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const output = await convertCover(small);
  const meta = await sharp(output.large).metadata();
  expect(meta.width).toBe(60); expect(meta.height).toBe(40); expect(meta.orientation).toBeUndefined();
});
it('rejects real SVG, corrupt, oversize, animated and excessive pixel inputs', async () => {
  for (const input of [Buffer.from('<svg width="10" height="10"></svg>'), Buffer.from('broken'), Buffer.alloc(8 * 1024 * 1024 + 1)]) await expect(convertCover(input)).rejects.toThrow();
  const huge = await sharp({ create: { width: 8000, height: 4001, channels: 3, background: 'white' } }).png().toBuffer();
  await expect(convertCover(huge)).rejects.toThrow();
  const pixels = Buffer.concat([Buffer.alloc(8 * 8 * 3, 10), Buffer.alloc(8 * 8 * 3, 240)]);
  const animated = await sharp(pixels, { raw: { width: 8, height: 16, channels: 3, pageHeight: 8 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  expect((await sharp(animated, { animated: true }).metadata()).pages).toBe(2);
  await expect(convertCover(animated)).rejects.toThrow();
});
it('rejects complex posters that cannot satisfy the large budget at quality 70', async () => {
  const input = await sharp(randomBytes(1600 * 1600 * 3), { raw: { width: 1600, height: 1600, channels: 3 } }).png().toBuffer();
  await expect(convertCover(input)).rejects.toThrow('excede el peso máximo');
});
it('rejects APNG control chunks even when the decoder exposes only the first page', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  const data = Buffer.alloc(8); data.writeUInt32BE(2, 0);
  const payload = Buffer.concat([Buffer.from('acTL'), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(8);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(payload));
  const chunk = Buffer.concat([length, payload, crc]);
  const animated = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
  await expect(convertCover(animated)).rejects.toThrow('estático válido');
});
