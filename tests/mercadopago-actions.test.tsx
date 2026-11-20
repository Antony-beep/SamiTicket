// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MercadoPagoActions } from '@/components/mercadopago-actions';

const mocks = vi.hoisted(() => ({ api: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/client-api', () => ({ clientApi: mocks.api }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
beforeEach(() => { vi.stubGlobal('React', React); mocks.api.mockReset(); mocks.refresh.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('blocks duplicate queries, preserves a retry after a failure and refreshes a confirmed payment', async () => {
  let fail!: (error: Error) => void;
  mocks.api.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  render(<MercadoPagoActions orderId="order-1" pending />);
  const query = screen.getByRole('button', { name: 'Consultar pago' });
  fireEvent.click(query); fireEvent.click(query);
  expect(mocks.api).toHaveBeenCalledTimes(1);
  fail(new Error('Sin conexión. Reintenta.'));
  await screen.findByText('Sin conexión. Reintenta.');
  expect(mocks.refresh).not.toHaveBeenCalled();
  mocks.api.mockResolvedValueOnce({ status: 'paid' });
  fireEvent.click(query);
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  expect(mocks.api).toHaveBeenLastCalledWith('/api/orders/order-1/refresh', 'POST');
  expect(screen.getByText('Pago confirmado. Tu entrada está lista.')).toBeTruthy();
});

it('does not offer another checkout when an entry is already paid or a refund is pending', () => {
  render(<MercadoPagoActions orderId="order-1" pending={false} />);
  expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Consultar pago' })).toBeTruthy();
});

it('shows when payment is processing and only offers another checkout after rejection', () => {
  const { rerender } = render(<MercadoPagoActions orderId="order-1" pending paymentAttempt="processing" />);
  expect(screen.getByRole('status').textContent).toContain('Mercado Pago sigue procesando');
  expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Consultar pago' })).toBeTruthy();

  rerender(<MercadoPagoActions orderId="order-1" pending paymentAttempt="rejected" />);
  expect(screen.getByRole('status').textContent).toContain('Mercado Pago rechazó el intento');
  expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeTruthy();
});

it('announces the verified result immediately, including an order without a payment attempt', async () => {
  mocks.api.mockResolvedValueOnce({ status: 'pending', paymentAttempt: 'processing' }).mockResolvedValueOnce({ status: 'pending', paymentAttempt: null });
  render(<MercadoPagoActions orderId="order-1" pending />);
  const query = screen.getByRole('button', { name: 'Consultar pago' });
  fireEvent.click(query);
  await screen.findByText(/Mercado Pago sigue procesando/);
  expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
  fireEvent.click(query);
  await screen.findByText(/no hay un pago confirmado para esta orden/);
});

it('checks a pending return once and leaves manual retry available', async () => {
  mocks.api.mockRejectedValueOnce(new Error('Sigue pendiente.'));
  render(<React.StrictMode><MercadoPagoActions orderId="order-1" pending returnedFromCheckout /></React.StrictMode>);
  await screen.findByText('Sigue pendiente.');
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith('/api/orders/order-1/refresh', 'POST');
  mocks.api.mockResolvedValueOnce({ status: 'paid' });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar pago' }));
  await screen.findByText('Pago confirmado. Tu entrada está lista.');
  expect(mocks.api).toHaveBeenCalledTimes(2);
});

it('simulates Mercado Pago states locally when demoEnabled is active', async () => {
  mocks.api
    .mockResolvedValueOnce({ status: 'in_process' })
    .mockResolvedValueOnce({ status: 'paid' });
  render(<MercadoPagoActions orderId="order-1" pending demoEnabled />);
  fireEvent.click(screen.getByRole('button', { name: 'Simular en proceso' }));
  await screen.findByText(/Mercado Pago sigue procesando/);
  expect(mocks.api).toHaveBeenCalledWith('/api/orders/order-1/simulate', 'POST', { state: 'in_process' });
  expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Simular aprobación MP' }));
  await screen.findByText('Pago simulado aprobado. Tu entrada está lista.');
  expect(mocks.api).toHaveBeenLastCalledWith('/api/orders/order-1/simulate', 'POST', { state: 'approved' });
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});
