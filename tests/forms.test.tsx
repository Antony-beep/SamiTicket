// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EventForm } from '@/components/event-form';
import { BuyerRegistration } from '@/components/buyer-registration';
import { LocationSearch } from '@/components/location-search';

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/client-api', () => ({ clientApi: mocks.api }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock('@/components/location-map', () => ({ LocationMap: () => <div>Mapa de prueba</div> }));
const initial = { id: '11111111-1111-4111-8111-111111111111', slug: 'test', title: 'Fiesta', description: 'Descripción', date: '2099-10-20', startTime: '20:00', venue: 'Local', address: 'Dirección', city: 'Cusco', reference: '', latitude: -13.53, longitude: -71.97, category: 'Música', outdoor: false, priceCents: 2500, capacity: 10, available: 10, status: 'draft' as const, coverSmallUrl: '/cover-small', coverLargeUrl: '/cover-large' };
beforeEach(() => {
  vi.stubGlobal('React', React); mocks.api.mockReset(); mocks.push.mockReset(); mocks.refresh.mockReset(); sessionStorage.clear();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ holiday: null }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('MVP forms', () => {
  it('persists an incomplete draft and opens its management page', async () => {
    mocks.api.mockResolvedValue({});
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText('Nombre del evento'), { target: { value: 'Mi borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(mocks.api).toHaveBeenCalledWith('/api/events', 'POST', expect.objectContaining({ title: 'Mi borrador', latitude: null, priceCents: 2500, capacity: 100 }));
    const id = mocks.api.mock.calls[0][2].id;
    expect(mocks.push).toHaveBeenCalledWith(`/panel/${id}`);
  });
  it('reuses the saved draft after a publication error', async () => {
    mocks.api.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Completa una fecha futura.')).mockResolvedValue({});
    render(<EventForm initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    await screen.findByText('Completa una fecha futura.');
    const id = mocks.api.mock.calls[0][2].id;
    fireEvent.change(screen.getByLabelText('Nombre del evento'), { target: { value: 'Evento corregido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/panel/${id}`));
    expect(mocks.api).toHaveBeenNthCalledWith(3, `/api/events/${id}`, 'PATCH', expect.objectContaining({ id, title: 'Evento corregido' }));
    expect(mocks.api).toHaveBeenNthCalledWith(4, `/api/events/${id}/publish`, 'POST');
  });
  it('marks invalid fields, focuses the first and does not send invalid data', async () => {
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText('Precio en soles'), { target: { value: '12,345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await screen.findByText('Usa un precio válido con máximo dos decimales.');
    expect(screen.getByLabelText('Precio en soles').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Precio en soles'));
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('requires a cover and complete fields for publication', async () => {
    render(<EventForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    await screen.findByText('Añade una portada para publicar.');
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre del evento'));
    expect(mocks.api).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nombre del evento'), { target: { value: 'Corregido' } });
    expect(screen.getByLabelText('Nombre del evento').getAttribute('aria-invalid')).toBe('false');
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre del evento'));
  });
  it('accepts comma prices with exact cents and preserves drafts after image failure', async () => {
    mocks.api.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Storage no disponible')).mockResolvedValue({ version: 'v2' });
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText('Precio en soles'), { target: { value: '0,29' } });
    fireEvent.change(screen.getByLabelText('Portada del evento'), { target: { files: [new File(['png'], 'cover.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await screen.findByText('Storage no disponible');
    const id = mocks.api.mock.calls[0][2].id;
    expect(mocks.api.mock.calls[0][2].priceCents).toBe(29);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/panel/${id}`));
    expect(mocks.api.mock.calls[2][0]).toBe(`/api/events/${id}`);
    expect(mocks.api.mock.calls[2][1]).toBe('PATCH');
  });
  it('uses Enter for search without submitting the parent form', async () => {
    const submitted = vi.fn(), selected = vi.fn();
    mocks.api.mockResolvedValue({ places: [] });
    render(<form onSubmit={submitted}><LocationSearch onSelect={selected} /></form>);
    fireEvent.change(screen.getByLabelText('Busca un local o dirección de Perú'), { target: { value: 'Cusco' } });
    fireEvent.keyDown(screen.getByLabelText('Busca un local o dirección de Perú'), { key: 'Enter' });
    await screen.findByText('Sin resultados. Completa la ubicación manualmente.');
    expect(mocks.api).toHaveBeenCalledTimes(1); expect(submitted).not.toHaveBeenCalled();
  });
  it('searches locations only after an explicit click', async () => {
    mocks.api.mockResolvedValue({ places: [{ id: 1, label: 'Huancayo, Perú', latitude: -12.06, longitude: -75.2, type: 'city' }] });
    const selected = vi.fn();
    render(<LocationSearch onSelect={selected} />);
    fireEvent.change(screen.getByLabelText('Busca un local o dirección de Perú'), { target: { value: 'Huancayo' } });
    expect(mocks.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Huancayo, Perú' }));
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ latitude: -12.06 }));
  });
  it('keeps one order attempt across double clicks and normalizes the buyer', async () => {
    mocks.api.mockResolvedValueOnce({ ready: true }).mockResolvedValueOnce({ url: '/pedido/test-order' });
    render(<BuyerRegistration eventId="event-1" available={1} demoEnabled />);
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Comprador' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'Buyer@Example.COM' } });
    const submit = screen.getByRole('button', { name: 'Continuar al pago simulado' });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/pedido/test-order'));
    expect(mocks.api).toHaveBeenCalledTimes(2);
    expect(mocks.api).toHaveBeenNthCalledWith(2, '/api/orders', 'POST', expect.objectContaining({ eventId: 'event-1', email: 'buyer@example.com' }));
    expect(sessionStorage.getItem('samiticket:checkout:event-1')).toContain('fingerprint');
  });
  it('disables purchases when no stock is available or demo payments are off', () => {
    const view = render(<BuyerRegistration eventId="event-1" available={0} demoEnabled />);
    expect((screen.getByRole('button') as HTMLButtonElement).closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByText('Entradas agotadas.')).toBeDefined();
    view.rerender(<BuyerRegistration eventId="event-1" available={10} demoEnabled={false} />);
    expect((screen.getByRole('button') as HTMLButtonElement).closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByText('Los pagos simulados están deshabilitados.')).toBeDefined();
  });
});
