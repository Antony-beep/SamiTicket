import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { SiteHeader } from '@/components/site-header';
import { Problem } from '@/components/problem';
import { PaymentActions } from '@/components/payment-actions';
import { MercadoPagoActions } from '@/components/mercadopago-actions';
import { TicketEmailButton } from '@/components/ticket-email-button';
import { receipt } from '@/lib/server/data';
import { pageData } from '@/lib/server/page-auth';
import { connection } from 'next/server';
import { formatCurrency, googleCalendarUrl } from '@/lib/events';
import { formatUsdEstimate, getPenToUsdRate } from '@/lib/server/currency';

export const metadata = { title: 'Tu entrada festiva | SamiTicket', robots: { index: false, follow: false } };

export default async function ReceiptPage({ params, searchParams }: PageProps<'/pedido/[id]'>) {
  await connection();
  const [{ id }, { retorno }] = await Promise.all([params, searchParams]);
  const result = await pageData(async () => {
    const [order, usdRate] = await Promise.all([receipt(id), getPenToUsdRate()]);
    const qr = order.token ? await QRCode.toDataURL(order.token, { width: 320, margin: 4, errorCorrectionLevel: 'M' }) : null;
    return { order, qr, usdEstimate: formatUsdEstimate(order.amountCents, usdRate) };
  });

  if (result.error !== undefined) {
    return (
      <main>
        <SiteHeader />
        <section className="container panel-page">
          <Problem message={result.error} />
        </section>
      </main>
    );
  }

  const { order, qr, usdEstimate } = result.data;
  const isPaid = order.status === 'paid';
  const isRejected = order.status === 'rejected';
  const gcalUrl = googleCalendarUrl({
    title: order.event.title,
    startsAt: order.event.starts_at,
    venue: order.event.venue,
    address: order.event.address,
    details: `Boleto oficial de SamiTicket para ${order.name}`,
  });

  return (
    <main>
      <SiteHeader />
      <section className="container panel-page receipt-page">
        <p className="eyebrow">Pase Oficial de Celebración</p>
        <h1>
          {isPaid
            ? '¡Tu entrada está lista para la fiesta!'
            : isRejected
            ? order.paymentMode === 'mp_test' ? 'Compra de prueba finalizada' : 'Pago simulado rechazado'
            : 'Completa tu compra'}
        </h1>

        <p className="notice">
          {order.paymentMode === 'mp_test' ? 'Mercado Pago · Prueba. Esta compra utiliza una cuenta vendedora ficticia de SamiTicket.' : 'Demostración: no se realizó ningún cobro.'} Guarda el PNG; el comprobante abre en este navegador mientras conserves tu sesión privada.
        </p>

        {/* Boleto Físico Coleccionable con Estilo Tradicional */}
        <article className="ticket-collector">
          {/* Cinta de Cenefa Andina Superior */}
          <div className="chumpi-band" aria-hidden="true" />

          {/* Encabezado del Boleto */}
          <div className="ticket-collector-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span className="ticket-seal-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Boleto Oficial de Fiesta
              </span>
              <span style={{ color: 'var(--brand-light)', fontSize: '0.85rem', fontWeight: 800 }}>
                SamiTicket Huancayo
              </span>
            </div>

            <h2>{order.event.title}</h2>
            <p>
              📍 {order.event.venue} · {order.event.address}
            </p>
            <p style={{ color: 'var(--gold)', fontWeight: 700 }}>
              📅 {order.event.starts_at && new Date(order.event.starts_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
            </p>
          </div>

          {/* Muescas Troqueladas Laterales y Línea de Desglose */}
          <div className="ticket-cutout-row" aria-hidden="true">
            <div className="ticket-perforated-line" />
          </div>

          {/* Cuerpo y Pase QR */}
          <div className="ticket-collector-body">
            <div className="ticket-meta-grid">
              <div className="ticket-meta-item">
                <span>Asistente</span>
                <strong>{order.name}</strong>
              </div>
              {order.dni && (
                <div className="ticket-meta-item">
                  <span>DNI verificado (RENIEC)</span>
                  <strong>{order.dni}</strong>
                </div>
              )}
              <div className="ticket-meta-item">
                <span>Correo registrado</span>
                <strong style={{ wordBreak: 'break-all' }}>{order.email}</strong>
              </div>
              <div className="ticket-meta-item">
                <span>Tipo de boleto</span>
                <strong>Entrada General</strong>
              </div>
              <div className="ticket-meta-item">
                <span>{isPaid ? 'Total pagado' : 'Total de la compra'}</span>
                <strong style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>{formatCurrency(order.amountCents)}</strong>
                {usdEstimate && <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{usdEstimate}</span>}
              </div>
            </div>

            {order.paymentMode === 'mp_test' && <>
              <MercadoPagoActions key={id} orderId={id} eventId={order.eventId} pending={order.status === 'pending' && !order.paymentState} isPaid={isPaid} demoEnabled={process.env.DEMO_PAYMENTS_ENABLED === 'true'} paymentAttempt={order.paymentAttempt} returnedFromCheckout={retorno === 'mercadopago'} />
              {order.paymentState && <p role="status">{order.paymentState === 'refund_pending' ? 'Pago de prueba recibido sin emitir otra entrada. Reembolso pendiente. Usa Consultar pago para reintentar su confirmación.' : isPaid ? 'Se confirmó el reembolso de un intento adicional. Tu entrada continúa válida.' : 'Reembolso de prueba confirmado. Esta compra no tiene una entrada habilitada.'}</p>}
            </>}
            {order.paymentMode === 'demo' && order.status === 'pending' && (
              process.env.DEMO_PAYMENTS_ENABLED === 'true' ? (
                <PaymentActions orderId={id} eventId={order.eventId} />
              ) : (
                <p>Los pagos simulados están deshabilitados.</p>
              )
            )}

            {isPaid && qr && (
              <div className="ticket-qr">
                <div className="ticket-qr-container">
                  <Image
                    src={qr}
                    width={280}
                    height={280}
                    unoptimized
                    alt="QR de tu entrada: válido para un solo ingreso en puerta"
                  />
                </div>
                <a className="button button-primary" href={`/api/orders/${id}/qr`} download>
                  📥 Descargar Pase QR en PNG
                </a>
                <TicketEmailButton orderId={id} email={order.email} />
                <details style={{ marginTop: '12px', width: '100%', maxWidth: '380px' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Ver token alfanumérico para validación manual
                  </summary>
                  <code className="token-text" style={{ marginTop: '8px' }}>{order.token}</code>
                </details>
                <p className="ticket-qr-notice">
                  ⚠️ Código con token intransferible. No compartas tu QR: quien lo presente primero en puerta ingresará a la fiesta.
                </p>
              </div>
            )}

            {isRejected && (
              <p className="notice notice-error">{order.paymentMode === 'mp_test' ? 'Esta compra de prueba no tiene una entrada habilitada.' : 'No se emitió una entrada ni se descontó stock.'}</p>
            )}

            <div className="actions" style={{ marginTop: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {gcalUrl && (
                <a href={gcalUrl} target="_blank" rel="noreferrer" className="button button-secondary">
                  📅 Añadir a Google Calendar
                </a>
              )}
              <a href={`/api/events/${order.eventId}/calendar`} download className="button button-secondary">
                Descargar .ics
              </a>
              <Link href={`/e/${order.event.slug}`} className="button button-secondary">
                ← Volver a la página del evento
              </Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
