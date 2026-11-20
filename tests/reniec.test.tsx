// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  buildPeruPassDeepLink,
  checkReniecStatus,
  createReniecRequest,
  lookupReniecDni,
  parseSdJwtClaims,
  simulateReniecVerification,
  verifyReniecToken,
  verifyStoredCredential,
} from '@/lib/server/reniec';
import { POST as reniecRoute } from '@/app/api/security/reniec/route';
import { BuyerRegistration } from '@/components/buyer-registration';
import { LoginPanel } from '@/components/login-panel';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  otp: vi.fn(),
}));

vi.mock('@/lib/client-api', () => ({ clientApi: mocks.api }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createClient: () => ({ auth: { signInWithOtp: mocks.otp } }),
}));

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubEnv('DEMO_PAYMENTS_ENABLED', 'true');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret-key-for-reniec-hmac');
  mocks.api.mockReset();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.otp.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function encodeDisclosure(claim: [string, string, string]) {
  return Buffer.from(JSON.stringify(claim), 'utf8').toString('base64url');
}

describe('RENIEC DNId OpenID4VP verification (DT-DCSD/SDSCD-034)', () => {
  it('builds the exact Peru Pass OpenID4VP deep link and parses SD-JWT disclosures', () => {
    const link = buildPeruPassDeepLink(
      'did:web:verify.inji-reniec.com:v1:verify',
      'https://verify.inji-reniec.com/v1/verify/vp-request/req_5ccc0964-6b08-4ecf-b869-93049fc95ce2'
    );
    expect(link).toBe(
      'openid4vp://authorize?client_id=did%3Aweb%3Averify.inji-reniec.com%3Av1%3Averify&request_uri=https%3A%2F%2Fverify.inji-reniec.com%2Fv1%2Fverify%2Fvp-request%2Freq_5ccc0964-6b08-4ecf-b869-93049fc95ce2'
    );

    const sdJwt = [
      'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJyZW5pZWMifQ.c2ln',
      encodeDisclosure(['sal_aleatoria_1', 'CUI_DNI', '47291038']),
      encodeDisclosure(['sal_aleatoria_2', 'PRENOMBRES', 'JUAN CARLOS']),
      encodeDisclosure(['sal_aleatoria_3', 'PRIMER_APELLIDO', 'QUISPE']),
      '',
    ].join('~');

    const parsed = parseSdJwtClaims(sdJwt);
    expect(parsed.dni).toBe('47291038');
    expect(parsed.name).toBe('JUAN CARLOS QUISPE');
  });

  it('completes VP request creation, polling status, SD-JWT extraction and VC re-verification', async () => {
    const sdJwt = [
      'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJyZW5pZWMifQ.c2ln',
      encodeDisclosure(['s1', 'CUI_DNI', '47291038']),
      encodeDisclosure(['s2', 'PRENOMBRES', 'MARIA ELENA']),
      '',
    ].join('~');

    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({
        transactionId: 'txn_68851035-db49-4860-890f-4362df268a76',
        requestId: 'req_5ccc0964-6b08-4ecf-b869-93049fc95ce2',
        expiresAt: Date.now() + 60000,
        requestUri: 'https://verify.inji-reniec.com/v1/verify/vp-request/req_5ccc0964-6b08-4ecf-b869-93049fc95ce2',
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ status: 'ACTIVE' }))
      .mockResolvedValueOnce(Response.json({ status: 'VP_SUBMITTED' }))
      .mockResolvedValueOnce(Response.json({
        transactionId: 'txn_68851035-db49-4860-890f-4362df268a76',
        vpResultStatus: 'SUCCESS',
        vcResults: [{ vc: sdJwt, verificationStatus: 'SUCCESS' }],
      }))
      .mockResolvedValueOnce(Response.json({ verificationStatus: 'SUCCESS' }));

    const started = await createReniecRequest();
    expect(started.status).toBe('ACTIVE');
    expect(started.qrDataUrl).toContain('data:image/png;base64,');

    const active = await checkReniecStatus(started.sessionToken);
    expect(active.status).toBe('ACTIVE');

    const completed = await checkReniecStatus(started.sessionToken);
    expect(completed.status).toBe('VERIFIED');
    if (completed.status === 'VERIFIED') {
      expect(completed.identity.dni).toBe('47291038');
      expect(completed.identity.name).toBe('MARIA ELENA');
      expect(verifyReniecToken(completed.identity.verificationToken)).toEqual({
        dni: '47291038',
        name: 'MARIA ELENA',
      });
    }

    await expect(verifyStoredCredential(sdJwt)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('requires DNId verification on purchase when reniecRequired is enabled and autocompletes buyer name', async () => {
    const simulated = simulateReniecVerification();
    mocks.api
      .mockResolvedValueOnce(simulated)
      .mockResolvedValueOnce({ ready: true })
      .mockResolvedValueOnce({ id: 'order-1', url: '/pedido/order-1' });

    render(<BuyerRegistration eventId="event-1" available={5} demoEnabled reniecRequired />);

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'comprador@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar al pago simulado' }));
    await screen.findByText('Verifica tu identidad con Perú Pass (DNId) antes de comprar.');
    expect(mocks.api).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Simular DNId (RENIEC)' }));
    await screen.findByText(/JUAN CARLOS QUISPE HUAMAN/);
    expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('JUAN CARLOS QUISPE HUAMAN');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar al pago simulado' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/pedido/order-1'));
    expect(mocks.api).toHaveBeenLastCalledWith('/api/orders', 'POST', expect.objectContaining({
      name: 'JUAN CARLOS QUISPE HUAMAN',
      email: 'comprador@example.com',
      reniecToken: simulated.identity.verificationToken,
    }));
  });

  it('allows optional DNId autocomplete in organizer login and forwards metadata to Supabase OTP', async () => {
    const simulated = simulateReniecVerification();
    mocks.api.mockResolvedValueOnce(simulated);
    mocks.otp.mockResolvedValueOnce({ error: null });

    render(<LoginPanel demoEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Simular DNId (RENIEC)' }));
    await screen.findByText(/47291038/);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'org@example.com' } });
    fireEvent.submit(screen.getByLabelText('Correo electrónico').closest('form')!);

    await waitFor(() => expect(mocks.otp).toHaveBeenCalledTimes(1));
    expect(mocks.otp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'org@example.com',
      options: expect.objectContaining({
        data: { full_name: 'JUAN CARLOS QUISPE HUAMAN', dni: '47291038' },
      }),
    }));
  });

  it('handles POST /api/security/reniec simulation on same origin', async () => {
    const res = await reniecRoute(new Request('http://localhost:3000/api/security/reniec', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate' }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('VERIFIED');
    expect(body.identity.dni).toBe('47291038');
  });

  it('autocompletes buyer name by entering an 8-digit DNI number', async () => {
    const resolved = await lookupReniecDni('72942689');
    expect(resolved.status).toBe('VERIFIED');
    expect(resolved.identity.dni).toBe('72942689');
    expect(resolved.identity.name).toBe('ANTONIO CARLOS CRISTOBAL QUISPE');

    mocks.api.mockResolvedValueOnce(resolved);
    render(<BuyerRegistration eventId="event-1" available={5} demoEnabled reniecRequired />);

    const dniInput = screen.getByLabelText('Número de DNI');
    fireEvent.change(dniInput, { target: { value: '72942689' } });
    fireEvent.click(screen.getByRole('button', { name: 'Autocompletar con DNI' }));

    await screen.findByText(/ANTONIO CARLOS CRISTOBAL QUISPE/);
    expect(mocks.api).toHaveBeenCalledWith('/api/security/reniec', 'POST', {
      action: 'lookup',
      dni: '72942689',
    });
    expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('ANTONIO CARLOS CRISTOBAL QUISPE');
  });
});
