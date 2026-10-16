import { AppError } from './validation';
export async function clientApi<T = { id: string }>(url: string, method = 'GET', data?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, cache: 'no-store',
      ...(data === undefined ? {} : data instanceof FormData ? { body: data } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    });
  } catch { throw new Error('No pudimos conectar. Comprueba internet y reintenta.'); }
  const result = await response.json();
  if (!response.ok) throw new AppError(result.message || 'No pudimos completar la acción.', response.status, result.errors);
  return result as T;
}
