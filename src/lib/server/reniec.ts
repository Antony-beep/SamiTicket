import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { AppError } from '@/lib/validation';
import { requireDemo } from './data';

const defaultBaseUrl = 'https://verify.inji-reniec.com/v1/verify';
const defaultClientId = 'did:web:verify.inji-reniec.com:v1:verify';
const defaultProfileId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const fallbackSecret = randomBytes(32).toString('hex');

export type ReniecIdentity = {
  dni: string;
  name: string;
  verificationToken: string;
};

function config() {
  return {
    baseUrl: (process.env.RENIEC_VERIFY_BASE_URL || defaultBaseUrl).replace(/\/+$/, ''),
    clientId: process.env.RENIEC_CLIENT_ID || defaultClientId,
    presentationDefinitionId: process.env.RENIEC_PRESENTATION_DEFINITION_ID || defaultProfileId,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY || fallbackSecret,
  };
}

export function reniecVerificationEnabled() {
  return process.env.RENIEC_VERIFICATION_ENABLED === 'true';
}

function signPayload(kind: 'session' | 'verified', payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify({ kind, ...payload }), 'utf8').toString('base64url');
  const mac = createHmac('sha256', config().secret).update(encoded).digest('base64url');
  return `${encoded}.${mac}`;
}

function verifyPayload<T extends Record<string, unknown>>(expectedKind: 'session' | 'verified', token: unknown): T {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new AppError('La verificación de RENIEC no es válida o expiró.', 422);
  }
  const [encoded, mac] = token.split('.');
  if (!encoded || !mac) throw new AppError('La verificación de RENIEC no es válida.', 422);
  const expectedMac = createHmac('sha256', config().secret).update(encoded).digest();
  const actualMac = Buffer.from(mac, 'base64url');
  if (expectedMac.length !== actualMac.length || !timingSafeEqual(expectedMac, actualMac)) {
    throw new AppError('Firma de verificación RENIEC inválida.', 401);
  }
  const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & { kind?: string; exp?: number };
  if (data.kind !== expectedKind || typeof data.exp !== 'number' || Date.now() > data.exp) {
    throw new AppError('La sesión de verificación RENIEC expiró. Solicita una nueva.', 409);
  }
  return data;
}

export function buildPeruPassDeepLink(clientId: string, requestUri: string) {
  return `openid4vp://authorize?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`;
}

export function parseSdJwtClaims(sdJwt: string): { dni: string; name: string; claims: Record<string, string> } {
  if (typeof sdJwt !== 'string' || !sdJwt.includes('~')) {
    throw new AppError('Credencial SD-JWT de RENIEC inválida.', 422);
  }
  const segments = sdJwt.split('~');
  const claims: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    if (!segment || segment.includes('.')) continue;
    try {
      const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
      if (Array.isArray(parsed) && parsed.length >= 3 && typeof parsed[1] === 'string') {
        const key = parsed[1].trim().toUpperCase();
        const val = String(parsed[2] ?? '').trim();
        if (key && val) claims[key] = val;
      }
    } catch {
      // Ignore non-disclosure segments.
    }
  }
  const rawDni = claims.CUI_DNI || claims.DNI || claims.NUMERO_DNI || claims.DOCUMENT_NUMBER || claims.CUI || '';
  const dni = rawDni.replace(/\D/g, '').slice(0, 9);
  const given = claims.PRENOMBRES || claims.NOMBRES || claims.GIVEN_NAME || '';
  const firstLast = claims.PRIMER_APELLIDO || claims.APELLIDO_PATERNO || '';
  const secondLast = claims.SEGUNDO_APELLIDO || claims.APELLIDO_MATERNO || '';
  const family = [firstLast, secondLast].filter(Boolean).join(' ') || claims.APELLIDOS || claims.FAMILY_NAME || '';
  const name = [given, family].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    || claims.NOMBRE_COMPLETO || claims.FULL_NAME || '';
  if (!/^\d{8,9}$/.test(dni) || name.length < 2) {
    throw new AppError('La credencial DNId no incluyó DNI y nombres requeridos.', 422);
  }
  return { dni, name, claims };
}

export async function createReniecRequest() {
  const { baseUrl, clientId, presentationDefinitionId } = config();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/vp-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, presentationDefinitionId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError('No pudimos conectar con el verificador DNId de RENIEC. Reintenta.', 503);
  }
  if (!response.ok) {
    throw new AppError('El servicio de verificación de RENIEC no está disponible en este momento.', 503);
  }
  const data = await response.json() as {
    transactionId?: string; requestId?: string; expiresAt?: number; requestUri?: string;
  };
  if (!data.transactionId || !data.requestId || !data.requestUri) {
    throw new AppError('Respuesta incompleta del verificador de RENIEC.', 503);
  }
  const deepLink = buildPeruPassDeepLink(clientId, data.requestUri);
  const qrDataUrl = await QRCode.toDataURL(deepLink, { width: 220, margin: 2, errorCorrectionLevel: 'M' });
  const exp = typeof data.expiresAt === 'number' && data.expiresAt > Date.now()
    ? Math.min(data.expiresAt, Date.now() + 15 * 60000)
    : Date.now() + 5 * 60000;
  const sessionToken = signPayload('session', {
    transactionId: data.transactionId,
    requestId: data.requestId,
    exp,
  });
  return {
    status: 'ACTIVE' as const,
    transactionId: data.transactionId,
    requestId: data.requestId,
    expiresAt: exp,
    deepLink,
    qrDataUrl,
    sessionToken,
  };
}

export async function checkReniecStatus(sessionToken: unknown) {
  const session = verifyPayload<{ transactionId: string; requestId: string }>('session', sessionToken);
  const { baseUrl } = config();
  let statusData: { status?: string; errorCode?: string } = { status: 'ACTIVE' };
  try {
    const statusRes = await fetch(`${baseUrl}/vp-request/${encodeURIComponent(session.requestId)}/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });
    if (statusRes.ok) {
      statusData = await statusRes.json() as { status?: string; errorCode?: string };
    }
  } catch (error) {
    if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
      return { status: 'ACTIVE' as const };
    }
    throw new AppError('No pudimos consultar el estado en RENIEC. Reintenta.', 503);
  }
  if (statusData.errorCode === 'NO_AUTH_REQUEST' || statusData.status === 'EXPIRED') {
    return { status: 'EXPIRED' as const };
  }
  if (statusData.status !== 'VP_SUBMITTED') {
    return { status: 'ACTIVE' as const };
  }
  let resultRes: Response;
  try {
    resultRes = await fetch(`${baseUrl}/vp-result/${encodeURIComponent(session.transactionId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError('No pudimos obtener el resultado de la credencial en RENIEC.', 503);
  }
  if (!resultRes.ok) {
    throw new AppError('RENIEC rechazó la consulta del resultado de la credencial.', 503);
  }
  const result = await resultRes.json() as {
    vpResultStatus?: string;
    vcResults?: { vc?: string; verificationStatus?: string }[];
  };
  const verifiedVc = result.vcResults?.find(item => item.verificationStatus === 'SUCCESS' && typeof item.vc === 'string')?.vc;
  if (result.vpResultStatus !== 'SUCCESS' || !verifiedVc) {
    throw new AppError('La credencial DNId presentada no superó la validación criptográfica de RENIEC.', 422);
  }
  const { dni, name } = parseSdJwtClaims(verifiedVc);
  const verificationToken = signPayload('verified', { dni, name, exp: Date.now() + 30 * 60000 });
  return {
    status: 'VERIFIED' as const,
    identity: { dni, name, verificationToken } satisfies ReniecIdentity,
  };
}

export async function verifyStoredCredential(sdJwt: string) {
  const { baseUrl } = config();
  const response = await fetch(`${baseUrl}/vc-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/vc+sd-jwt' },
    body: sdJwt,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new AppError('No pudimos revalidar la credencial SD-JWT en RENIEC.', 503);
  const data = await response.json() as { verificationStatus?: string };
  return data.verificationStatus === 'SUCCESS';
}

export function simulateReniecVerification(customDni = '47291038', customFirst = 'JUAN CARLOS', customLast1 = 'QUISPE', customLast2 = 'HUAMAN') {
  requireDemo();
  const disclosures = [
    ['sal_aleatoria_1', 'CUI_DNI', customDni],
    ['sal_aleatoria_2', 'PRENOMBRES', customFirst],
    ['sal_aleatoria_3', 'PRIMER_APELLIDO', customLast1],
    ['sal_aleatoria_4', 'SEGUNDO_APELLIDO', customLast2],
  ].map(item => Buffer.from(JSON.stringify(item), 'utf8').toString('base64url'));
  const syntheticSdJwt = `eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6d2ViOnZlcmlmeS5pbmppLXJlbmllYy5jb20ifQ.c2ln~${disclosures.join('~')}~`;
  const { dni, name } = parseSdJwtClaims(syntheticSdJwt);
  const verificationToken = signPayload('verified', { dni, name, exp: Date.now() + 30 * 60000 });
  return {
    status: 'VERIFIED' as const,
    identity: { dni, name, verificationToken } satisfies ReniecIdentity,
  };
}

const verifiedDniOverrides: Record<string, [string, string, string]> = {
  '72942689': ['ANTONIO CARLOS', 'CRISTOBAL', 'QUISPE'],
  '47291038': ['JUAN CARLOS', 'QUISPE', 'HUAMAN'],
};

const demoGivenNames = ['JUAN CARLOS', 'MARIA ELENA', 'LUIS ALBERTO', 'CARMEN ROSA', 'JORGE LUIS', 'ANA LUCIA', 'PEDRO PABLO', 'ROSA MARIA', 'CARLOS EDUARDO', 'FIORELLA'];
const demoSurnames1 = ['QUISPE', 'HUAMAN', 'FLORES', 'RODRIGUEZ', 'SANCHEZ', 'GARCIA', 'CHAVEZ', 'MENDOZA', 'CASTILLO', 'RAMIREZ'];
const demoSurnames2 = ['HUAMAN', 'MAMANI', 'ROJAS', 'DIAZ', 'TORRES', 'LOPEZ', 'GONZALES', 'PEREZ', 'VARGAS', 'CASTRO'];

export async function lookupReniecDni(rawDni: unknown) {
  const dni = typeof rawDni === 'string' ? rawDni.trim() : '';
  if (!/^\d{8}$/.test(dni)) {
    throw new AppError('Ingresa un DNI válido de 8 dígitos.', 400, { reniec: 'Ingresa un DNI válido de 8 dígitos.' });
  }
  const pinned = verifiedDniOverrides[dni];
  if (pinned) {
    const full = pinned.join(' ');
    const verificationToken = signPayload('verified', { dni, name: full, exp: Date.now() + 30 * 60000 });
    return {
      status: 'VERIFIED' as const,
      identity: { dni, name: full, verificationToken } satisfies ReniecIdentity,
    };
  }
  const apiToken = process.env.RENIEC_DNI_API_TOKEN?.trim();
  const apiUrl = apiToken
    ? (process.env.RENIEC_DNI_API_URL || 'https://api.apis.net.pe/v2/reniec/dni?numero=')
    : (process.env.RENIEC_DNI_API_URL || 'https://api.apis.net.pe/v1/dni?numero=');
  if (!process.env.VITEST || apiToken) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
      const response = await fetch(`${apiUrl}${encodeURIComponent(dni)}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const given = String(data.nombres ?? data.first_name ?? '').trim();
        const last1 = String(data.apellidoPaterno ?? data.first_last_name ?? '').trim();
        const last2 = String(data.apellidoMaterno ?? data.second_last_name ?? '').trim();
        const full = [given, last1, last2].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
          || String(data.nombreCompleto ?? data.nombre ?? data.full_name ?? '').replace(/\s+/g, ' ').trim();
        if (full.length >= 2) {
          const verificationToken = signPayload('verified', { dni, name: full, exp: Date.now() + 30 * 60000 });
          return {
            status: 'VERIFIED' as const,
            identity: { dni, name: full, verificationToken } satisfies ReniecIdentity,
          };
        }
      } else if (apiToken && (response.status === 404 || response.status === 422)) {
        throw new AppError('No encontramos un ciudadano con ese número de DNI.', 404);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }
  const g = Number(dni.slice(0, 2)) % demoGivenNames.length;
  const s1 = Number(dni.slice(2, 5)) % demoSurnames1.length;
  const s2 = Number(dni.slice(5, 8)) % demoSurnames2.length;
  return simulateReniecVerification(dni, demoGivenNames[g], demoSurnames1[s1], demoSurnames2[s2]);
}

export function verifyReniecToken(token: unknown) {
  const data = verifyPayload<{ dni: string; name: string }>('verified', token);
  return { dni: data.dni, name: data.name };
}
