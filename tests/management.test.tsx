// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteEvent } from '@/components/delete-event';
import { LoginPanel } from '@/components/login-panel';
const mock = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), refresh: vi.fn(), otp: vi.fn() }));
vi.mock('@/lib/client-api', () => ({ clientApi: mock.api }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push, refresh: mock.refresh }) }));
vi.mock('@/lib/supabase/client', () => ({ isSupabaseConfigured: () => true, createClient: () => ({ auth: { signInWithOtp: mock.otp } }) }));
beforeEach(() => { vi.stubGlobal('React', React); for (const value of Object.values(mock)) value.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows the event name and consequences, focuses preserve, and deletes once after confirmation', async () => {
  mock.api.mockResolvedValue({ deleted: true });
  render(<DeleteEvent id="event" title="Fiesta del barrio" hasOrders={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar evento' }));
  expect(screen.getByText('Fiesta del barrio')).toBeDefined(); expect(screen.getByText(/Su enlace dejará de funcionar/)).toBeDefined();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Conservar evento' }));
  const button = screen.getByRole('button', { name: 'Eliminar definitivamente' }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith('/panel?deleted=1')); expect(mock.api).toHaveBeenCalledTimes(1);
});
it('does not offer deletion for any registered order', () => {
  render(<DeleteEvent id="event" title="Fiesta" hasOrders />);
  expect(screen.queryByRole('button', { name: 'Eliminar evento' })).toBeNull(); expect(screen.getByText(/tiene órdenes registradas/)).toBeDefined();
});
it('normalizes login email, preserves a safe destination and blocks duplicate submissions', async () => {
  let finish!: (result: { error: null }) => void;
  mock.otp.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<LoginPanel next="//evil.example" />);
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: ' User@Example.COM ' } });
  const form = screen.getByLabelText('Correo electrónico').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mock.otp).toHaveBeenCalledTimes(1);
  expect(mock.otp).toHaveBeenCalledWith(expect.objectContaining({ email: 'user@example.com', options: { emailRedirectTo: expect.stringContaining('next=%2Fpanel') } }));
  finish({ error: null }); await screen.findByText(/Revisa tu correo/);
});
