import 'server-only';
import QRCode from 'qrcode';
import { formatCurrency } from '@/lib/events';
import { AppError, email } from '@/lib/validation';
import { receipt, requireDemo } from './data';

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

export async function sendTicketEmail(orderId: string) {
  const order = await receipt(orderId);
  if (order.status !== 'paid' || !order.token) {
    throw new AppError('La entrada debe estar pagada y emitida antes de enviarla por correo.', 409);
  }
  const pngBuffer = await QRCode.toBuffer(order.token, { width: 320, margin: 4, errorCorrectionLevel: 'M' });
  const dateText = order.event.starts_at
    ? new Date(order.event.starts_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })
    : 'Fecha por confirmar';
  const subject = `Tu entrada oficial para ${order.event.title} | SamiTicket`;
  const html = [
    '<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#141210;color:#f7f2eb;border-radius:16px;border:1px solid #3a2e25">',
    '<p style="color:#e5a93c;font-weight:700;margin:0 0 8px">SamiTicket Huancayo · Boleto Oficial</p>',
    `<h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(order.event.title)}</h1>`,
    `<p style="margin:0 0 6px;color:#d6cdc2">📍 ${escapeHtml(order.event.venue)} · ${escapeHtml(order.event.address)}</p>`,
    `<p style="margin:0 0 16px;color:#e5a93c;font-weight:700">📅 ${escapeHtml(dateText)}</p>`,
    '<hr style="border:none;border-top:1px dashed #3a2e25;margin:16px 0" />',
    `<p style="margin:4px 0"><strong>Asistente:</strong> ${escapeHtml(order.name)}</p>`,
    order.dni ? `<p style="margin:4px 0"><strong>DNI verificado (RENIEC):</strong> ${escapeHtml(order.dni)}</p>` : '',
    `<p style="margin:4px 0"><strong>Total pagado:</strong> ${escapeHtml(formatCurrency(order.amountCents))}</p>`,
    '<p style="margin:16px 0 8px;font-size:13px;color:#d6cdc2">Tu código QR va adjunto en PNG. Token manual de respaldo:</p>',
    `<code style="display:block;padding:10px;background:#1f1b18;border-radius:8px;word-break:break-all;font-size:12px;color:#f7f2eb">${escapeHtml(order.token)}</code>`,
    '</div>',
  ].join('');

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'SamiTicket <onboarding@resend.dev>';

  if (apiKey) {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [order.email],
          subject,
          html,
          attachments: [
            {
              filename: `entrada-${order.id.slice(0, 8)}.png`,
              content: pngBuffer.toString('base64'),
            },
          ],
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new AppError('No pudimos conectar con Resend para enviar el correo.', 503);
    }

    if (response.ok) {
      const data = await response.json() as { id?: string };
      return {
        mode: 'resend' as const,
        sentTo: order.email,
        emailId: data.id ?? null,
        subject,
      };
    }

    if (process.env.DEMO_PAYMENTS_ENABLED === 'true') {
      return {
        mode: 'simulated' as const,
        sentTo: order.email,
        emailId: null,
        subject,
        note: 'Resend en plan gratuito sin dominio propio solo entrega al correo dueño de la cuenta Resend; se registró el envío simulado para la demo.',
      };
    }
    throw new AppError('Resend rechazó el envío del correo. Verifica tu clave o destinatario.', 503);
  }

  requireDemo();
  return {
    mode: 'simulated' as const,
    sentTo: order.email,
    emailId: null,
    subject,
    note: 'Envío simulado de demostración (añade RESEND_API_KEY en .env.local para entrega real con Resend).',
  };
}
