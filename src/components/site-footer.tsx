import Link from 'next/link';

export function SiteFooter() {
  return <footer className="site-footer container"><Link className="brand" href="/">sami<span>ticket</span><span className="brand-period">.</span></Link><p>Hecho para encontrarnos. Huancayo y todo el Perú.</p><span>Demo · Pagos simulados</span></footer>;
}
