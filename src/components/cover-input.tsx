'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { FieldError } from './field-errors';

export function CoverInput({ file, currentUrl, onChange, errors, disabled }: { file: File | null; currentUrl?: string | null; onChange: (file: File | null) => void; errors: Record<string, string>; disabled?: boolean }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setPreview({ file, url: reader.result }); };
    reader.readAsDataURL(file);
    return () => { reader.onload = null; reader.abort(); };
  }, [file]);
  const url = file && preview?.file === file ? preview.url : currentUrl;
  return <div className="field-group cover-input">
    <label htmlFor="cover">Portada del evento</label>
    <p className="field-help" id="cover-help">JPEG, PNG o WebP estático. Hasta 8 MiB y 32 megapíxeles. Obligatoria para publicar. Generamos dos versiones WebP.</p>
    <input id="cover" data-field="cover" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-invalid={Boolean(errors.cover)} aria-describedby={`cover-help${errors.cover ? ' cover-error' : ''}`} onChange={e => onChange(e.target.files?.[0] ?? null)} />
    <FieldError name="cover" errors={errors} />
    {url && <Image className="cover-preview" src={url} alt="Vista previa de la portada" width={640} height={640} unoptimized />}
  </div>;
}
