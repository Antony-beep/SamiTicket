---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/e/[slug]/page.tsx","src/app/globals.css","src/components/site-header.tsx"]
---

# Catálogo y detalle de SamiTicket

Targets: src/app/page.tsx, src/app/e/[slug]/page.tsx, src/app/globals.css, src/components/site-header.tsx.

Mode: Operate. El visitante busca un evento, consulta su afiche, ubicación y fecha, y compra una entrada. El organizador accede a su panel desde la navegación común.

Decisiones confirmadas: interfaz nocturna elegante con acentos de fiesta; catálogo y detalle primero. Se implementa directamente en código por tratarse del catálogo de una aplicación. No se establece un valor predeterminado para futuras superficies promocionales.

## Direction contract

THESIS: Una invitación nocturna al encuentro. El afiche tiene prioridad y los controles permanecen legibles; desaparecen los brillos multicolor y los reclamos sin respaldo.

OWN-WORLD: Carbón ligeramente cálido, blanco tiza y coral. Manrope para títulos, Inter para lectura. Botones de shadcn, campos sobrios y portadas de organizadores.

STORY: Explorar la cartelera real, localizar fecha y lugar, abrir el afiche completo y continuar al pago simulado. Errores y disponibilidad se muestran explícitamente.

FIRST VIEWPORT: Navegación baja, título amplio alineado a izquierda, búsqueda sobre la cartelera y portadas de proporción vertical. Sin panel de beneficios ni tarjetas promocionales que compitan con los eventos.

FORM: Invitación de club nocturno, posición 6. seed:8eeb59e2c21121df. La preferencia nocturna minimalista del usuario prevalece. La disciplina de jerarquía tipográfica del cartel de festival informa la escala, sin sustituir los afiches. Movimiento distintivo: ShiftCard desplaza suavemente el bloque de información al enfocar o pasar el puntero; las acciones esenciales siempre permanecen disponibles y el movimiento respeta preferencias reducidas.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Ampliación Cult UI confirmada, 18 de noviembre de 2026

El usuario solicita LightBoard debajo del hero con neón rojo inspirado en Danger Zone; Halo Input, Dropzone, Segmented, Progress, Card; Dynamic Island para avisos; Gradient Button Group y Cutout Card para eventos. Estos requisitos sustituyen la prohibición anterior de brillos y gradientes en las superficies elegidas, conservando la base nocturna.

Plan de movimiento: el momento principal es el confeti breve después de guardar correctamente un evento nuevo. Las acciones responden con color; los avisos mantienen continuidad durante navegación y las cargas usan progreso indeterminado sin porcentajes inventados. El letrero puede pausarse. Las animaciones Halo se suspenden fuera de pantalla y con pestaña oculta; la preferencia de movimiento reducido conserva datos y avisos, elimina confeti y usa texto estático para el letrero. Las portadas se conservan tras fallos y todas las acciones esenciales permanecen visibles con teclado y en móvil.

Resultado de la ampliación: Cutout sustituye ShiftCard en catálogo y panel; los datos permanecen visibles sin hover. El confeti espera el montaje del panel del evento recién creado. Los SVG del clima acompañan la condición diaria y conservan el detalle horario separado.

Revisión independiente del 18 de noviembre de 2026: `disposition: ship`, sin correcciones materiales pendientes. Catorce capturas válidas de escritorio, móvil y estados; la recaptura de celebración muestra el panel real bajo el aviso y el confeti. Detector ejecutado una vez: conserva avisos documentados de tokens heredados y acentos de esta ampliación; no se afirma una pasada limpia. DESIGN.md y el sidecar schemaVersion 2 describen el código entregado. No se añaden imágenes raster de producción.
