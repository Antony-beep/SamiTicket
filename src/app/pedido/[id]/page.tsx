import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { SiteHeader } from '@/components/site-header';
import { Problem } from '@/components/problem';
import { PaymentActions } from '@/components/payment-actions';
import { receipt } from '@/lib/server/data';
import { pageData } from '@/lib/server/page-auth';
import { connection } from 'next/server';
import { formatCurrency } from '@/lib/events';

export const metadata = { title: 'Tu entrada | SamiTicket', robots: { index: false, follow: false } };
export default async function ReceiptPage({ params }: PageProps<'/pedido/[id]'>) {
  await connection();
  const { id } = await params;
  const result = await pageData(async () => {
    const order = await receipt(id);
    const qr = order.token ? await QRCode.toDataURL(order.token, { width: 320, margin: 4, errorCorrectionLevel: 'M' }) : null;
    return { order, qr };
  });
  if (result.error !== undefined) return <main><SiteHeader /><section className="container panel-page"><Problem message={result.error} /></section></main>;
  const { order, qr } = result.data;
    return <main><SiteHeader /><section className="container panel-page receipt-page"><p className="eyebrow">Comprobante privado</p><h1>{order.status === 'paid' ? 'Tu entrada está lista' : order.status === 'rejected' ? 'Pago simulado rechazado' : 'Completa tu compra'}</h1>
      <p className="notice">Demostración: no se realizó ningún cobro. Guarda el PNG; el comprobante solo abre en este navegador mientras conserves su sesión privada.</p>
      <article className="panel-card"><h2>{order.event.title}</h2><p>{order.event.venue} · {order.event.address}</p><p>{order.event.starts_at && new Date(order.event.starts_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p><p>{order.name} · {order.email}</p><p>Una entrada general · <strong>{formatCurrency(order.amountCents)}</strong></p>
        {order.status === 'pending' && (process.env.DEMO_PAYMENTS_ENABLED === 'true' ? <PaymentActions orderId={id} eventId={order.eventId} /> : <p>Los pagos simulados están deshabilitados.</p>)}
        {order.status === 'paid' && qr && <div className="ticket-qr"><Image src={qr} width={320} height={320} unoptimized alt="QR de tu entrada: válido para un solo ingreso" /><a className="button button-primary" href={`/api/orders/${id}/qr`} download>Descargar QR en PNG</a><details><summary>Ver token para ingreso manual</summary><code className="token-text">{order.token}</code></details><p>No compartas tu QR: quien lo use primero podrá ingresar.</p></div>}
        {order.status === 'rejected' && <p>No se emitió una entrada ni se descontó stock.</p>}
        <div className="actions"><Link href={`/e/${order.event.slug}`} className="button button-secondary">Volver al evento</Link></div>
      </article></section></main>;
}
