import 'server-only';
import { email } from '@/lib/validation';

export type EmailVerification = { status: 'accepted' | 'rejected' | 'unknown'; message: string };
export async function verifyEmail(value: unknown): Promise<EmailVerification> {
  const address = email(value);
  try {
    const response = await fetch(`https://www.disify.com/api/email/${encodeURIComponent(address)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Verifier unavailable');
    const data = await response.json() as { disposable?: boolean; format?: boolean; dns?: boolean };
    if (typeof data.disposable !== 'boolean') throw new Error('Invalid verifier response');
    if (data.disposable || data.format === false || data.dns === false) return { status: 'rejected', message: 'Usa un correo válido y no temporal para recibir tu entrada.' };
    return { status: 'accepted', message: 'Correo apto para tu entrada.' };
  } catch {
    return { status: 'unknown', message: 'No pudimos verificar el correo. Reintenta antes de comprar.' };
  }
}
