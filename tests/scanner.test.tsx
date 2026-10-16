// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Scanner } from '@/components/scanner';
const camera = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }));
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromConstraints = camera.decode; } }));
beforeEach(() => {
  vi.stubGlobal('React', React);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  camera.decode.mockReset(); camera.stop.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('door scanner failure handling', () => {
  it('allows manual entry and prevents repeated submissions while validating', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<Scanner eventId="test-event" />);
    fireEvent.change(screen.getByLabelText('Token de la entrada'), { target: { value: 'a'.repeat(64) } });
    fireEvent.submit(screen.getByLabelText('Token de la entrada').closest('form')!);
    fireEvent.submit(screen.getByLabelText('Token de la entrada').closest('form')!);
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(Response.json({ status: 'accepted' }));
    await screen.findByText('Ingreso autorizado');
  });
  it('does not validate offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const fetcher = vi.spyOn(globalThis, 'fetch');
    render(<Scanner eventId="test-event" />);
    fireEvent.change(screen.getByLabelText('Token de la entrada'), { target: { value: 'a'.repeat(64) } });
    fireEvent.submit(screen.getByLabelText('Token de la entrada').closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('Sin conexión');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('offers manual entry after camera permission is denied', async () => {
    camera.decode.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    render(<Scanner eventId="test-event" />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir cámara' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No pudimos abrir la cámara'));
    expect(screen.getByLabelText('Token de la entrada')).toBeDefined();
  });
  it('reports a lost network response without authorizing entry', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Scanner eventId="test-event" />);
    fireEvent.change(screen.getByLabelText('Token de la entrada'), { target: { value: 'a'.repeat(64) } });
    fireEvent.submit(screen.getByLabelText('Token de la entrada').closest('form')!);
    await screen.findByText('No pudimos conectar. Comprueba internet y reintenta.');
    expect(screen.queryByText('Ingreso autorizado')).toBeNull();
  });
});
