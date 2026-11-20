# SamiTicket

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Organizadores de eventos locales de 50 a 500 personas en Perú, compradores sin cuenta y personal que controla el ingreso. La comunidad festiva de Huancayo y el Valle del Mantaro forma parte de la identidad actual; el servicio admite eventos en todo Perú.

## Product Purpose

Reunir publicación, compra y acceso en un flujo verificable: crear un evento, publicarlo, comprar una entrada, descargar su QR y validarlo una sola vez.

## Operating Context

Uso desde navegadores móviles y PC. La demostración usa Supabase remoto y requiere internet, también en puerta. El organizador configura el evento, comparte su enlace y asigna personal por correo verificado.

## Capabilities and Constraints

Next.js App Router, Tailwind, Supabase Auth y PostgreSQL. Conservar autenticación, panel, borradores, portadas WebP, ubicación ajustable con OpenStreetMap, navegación a Google Maps, clima según coordenadas, stock transaccional, comprobantes privados y control de puerta. Hay simulación local y Checkout Pro de Mercado Pago en Prueba con vendedor ficticio, reservas temporales y confirmación en servidor. No hay cobros reales, liquidaciones a organizadores, correos transaccionales ni validación offline. No modificar contratos del backend durante el rediseño.

## Brand Commitments

Nombre SamiTicket. Idioma español. Mantener la energía de fiesta y la conexión con celebraciones peruanas. El usuario pide una interfaz elegante y minimalista con componentes de shadcn y Cult UI.

## Evidence on Hand

Los eventos publicados proceden de Supabase. Sus portadas son aportadas por organizadores. No presentar eventos ilustrativos como disponibles para comprar ni anunciar capacidades que aún no existen. Las pruebas locales cubren validaciones y flujos de compra y acceso.

## Product Principles

- La portada y los datos del evento ayudan a decidir antes de comprar.
- Preservar datos, permisos y mensajes reales de error.
- Mantener formularios accesibles y cómodos en móvil.
- Mostrar con claridad las limitaciones de la demostración.
