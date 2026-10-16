import Link from "next/link";
import { AuthControl } from "@/components/auth/auth-control";
import { EventForm } from "@/components/event-form";
import { pageActor } from "@/lib/server/page-auth";

export default async function CreateEventPage() {
  await pageActor('/crear-evento');
  return (
    <main>
      <header className="site-header container">
        <Link className="brand" href="/">Sami<span>Ticket</span></Link>
        <div className="header-actions">
          <Link className="button button-secondary" href="/">Cancelar</Link>
          <AuthControl />
        </div>
      </header>
      <section className="form-page container">
        <div className="form-intro">
          <p className="eyebrow">Nuevo evento</p>
          <h1>Configura tu venta en pocos minutos.</h1>
          <p>Sube tu afiche, marca la entrada exacta y consulta el clima para cualquier lugar del Perú. Puedes guardar y completar el borrador después.</p>
        </div>
        <EventForm />
      </section>
    </main>
  );
}
