import Link from 'next/link';
import { AuthControl } from '@/components/auth/auth-control';
import { Ticket01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export function Brand() {
  return <Link className="brand" href="/" aria-label="SamiTicket, inicio"><HugeiconsIcon icon={Ticket01Icon} size={25} strokeWidth={1.5} aria-hidden="true" />sami<span>ticket</span><span className="brand-period">.</span></Link>;
}

export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header container">
        <div className="brand-group">
          <Brand />
        </div>
        <nav aria-label="Navegación principal">
          <Link className="catalog-nav" href="/#eventos">Cartelera</Link>
          <Link href="/crear-evento">Crear evento</Link>
          <AuthControl />
        </nav>
      </header>
      <span id="contenido" tabIndex={-1} />
    </>
  );
}
