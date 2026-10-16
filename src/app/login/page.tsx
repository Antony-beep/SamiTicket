import Link from "next/link";
import { LoginPanel } from "@/components/login-panel";
import { safeNext } from "@/lib/validation";

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <header className="site-header container">
        <Link className="brand" href="/">Sami<span>Ticket</span></Link>
      </header>
      <section className="container auth-layout">
        <div className="auth-copy">
          <p className="eyebrow">Organiza mejor</p>
          <h1>Deja atrás las listas y capturas de pago.</h1>
          <p>Crea tu evento, comparte un enlace y controla el ingreso con QR desde cualquier celular.</p>
        </div>
        <LoginPanel next={safeNext(params.next)} authError={params.error === 'auth'} />
      </section>
    </main>
  );
}
