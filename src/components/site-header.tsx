import Link from 'next/link';
import { AuthControl } from '@/components/auth/auth-control';

export function SiteHeader() {
  return (
    <>
      <div className="santiago-top-ribbon" aria-hidden="true" />
      <header className="site-header container">
        <div className="brand-group">
          <Link className="brand" href="/">Sami<span>Ticket</span></Link>
          <span className="brand-badge">Valle del Mantaro · Perú</span>
        </div>
        <nav>
          <Link href="/crear-evento">Crear evento</Link>
          <AuthControl />
        </nav>
      </header>
    </>
  );
}
