import { actor, ownerSummary } from '@/lib/server/data';
import { api } from '@/lib/server/http';
import { uuid } from '@/lib/validation';

function csvCell(value: unknown) {
  const raw = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildOrdersCsv(orders: {
  id: string;
  buyer_name: string;
  buyer_dni?: string | null;
  buyer_email: string;
  amount_cents: number;
  status: string;
  created_at: string;
}[]) {
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    paid: 'Aprobado',
    rejected: 'Rechazado',
  };
  const header = ['Orden ID', 'Comprador', 'DNI RENIEC', 'Correo', 'Importe (PEN)', 'Estado', 'Fecha (UTC)'].join(',');
  const rows = orders.map(order => [
    csvCell(order.id),
    csvCell(order.buyer_name),
    csvCell(order.buyer_dni || 'No registrado'),
    csvCell(order.buyer_email),
    csvCell((order.amount_cents / 100).toFixed(2)),
    csvCell(statusLabels[order.status] ?? order.status),
    csvCell(order.created_at),
  ].join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}

export async function GET(_request: Request, context: RouteContext<'/api/events/[id]/export'>) {
  return api(async () => {
    const id = uuid((await context.params).id);
    const user = await actor();
    const summary = await ownerSummary(id, user);
    const csv = buildOrdersCsv(summary.orders);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="padron-${id.slice(0, 8)}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
