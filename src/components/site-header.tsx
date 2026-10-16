import Link from 'next/link';
import { AuthControl } from '@/components/auth/auth-control';

export function SiteHeader() {
  return <header className="site-header container">
    <Link className="brand" href="/">Sami<span>Ticket</span></Link>
    <nav><Link href="/crear-evento">Crear evento</Link><AuthControl /></nav>
  </header>;
}
