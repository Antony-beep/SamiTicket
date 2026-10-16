'use client';
import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="container panel-page"><h1>No pudimos cargar esta página</h1>
    <p>Comprueba tu conexión. El servidor requiere las claves de Supabase y la migración del MVP aplicada.</p>
    <div className="actions"><button className="button button-primary" onClick={reset}>Reintentar</button><Link href="/" className="button button-secondary">Volver al inicio</Link></div>
  </main>;
}
