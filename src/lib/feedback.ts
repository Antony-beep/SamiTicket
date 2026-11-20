export type Notice = { title: string; description?: string; tone?: 'success' | 'error' | 'info'; celebrate?: boolean; eventId?: string };
export function notify(notice: Notice) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('samiticket:notice', { detail: notice }));
}
export function requestActivity(delta: 1 | -1) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('samiticket:request', { detail: delta }));
}
