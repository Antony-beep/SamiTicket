# SamiTicket

MVP de eventos locales con Next.js, Supabase, entradas QR y control de ingreso en línea. Los pagos son exclusivamente simulados.

## Preparación local

Recomendado: Node.js 24.15 o superior dentro de la rama 24, y npm. No se necesita PostgreSQL local para las pruebas normales.

1. Ejecuta `npm ci`.
2. Crea un proyecto Supabase de **demostración**.
3. Ejecuta en orden `supabase/migrations/202610160001_mvp.sql` y `supabase/migrations/202610160002_event_improvements.sql` en el SQL Editor como administrador. Si ya aplicaste la primera, ejecuta solamente la segunda. Esta agrega referencia, portadas, cola de limpieza y borrado transaccional; crea el bucket privado `event-covers`. La migración se aplica una vez, dentro de una transacción; no borra datos existentes. Si ya existen tablas con esos nombres, revisa el conflicto antes de aplicarla.
4. Copia `.env.example` a `.env.local` y configura:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU-CLAVE-PUBLICA
SUPABASE_SERVICE_ROLE_KEY=TU-CLAVE-SERVICE-ROLE
DEMO_PAYMENTS_ENABLED=true
NOMINATIM_CONTACT=TU-CORREO-O-URL-DE-CONTACTO
```

`SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor. Nunca la expongas con `NEXT_PUBLIC_`. Reinicia Next.js después de cambiar variables. Sin `DEMO_PAYMENTS_ENABLED=true`, no se pueden crear órdenes ni simular pagos.

5. En Supabase Auth, añade `http://localhost:3000/auth/callback` como Redirect URL. Configura Site URL como `http://localhost:3000`. Activa correo/Magic Link y, si se usan, Google, Facebook y Azure/Microsoft con sus credenciales y callbacks propios de Supabase.
6. Ejecuta `npm run dev` y abre [SamiTicket local](http://localhost:3000).

La compra no envía correos. El login con Magic Link sí utiliza Supabase Auth. Disify recibe el correo del comprador para verificarlo antes de crear la orden.

## Guion de demostración

1. **Organizador:** entra por `/login`. Crea un evento en `/crear-evento`; prueba guardar un borrador incompleto y editarlo desde `/panel`.
2. Completa descripción, fecha/hora futura, local, dirección, ciudad, coordenadas, precio y cantidad. Añade una portada JPEG, PNG o WebP estático de hasta 8 MiB y 32 megapíxeles. La fecha usa `America/Lima`. Para una demo pequeña puedes usar un cupo de 1 o 2.
3. Busca una ubicación con el botón **Buscar** o introdúcela manualmente. Ejemplo de coordenadas de Huancayo: latitud `-12.06513`, longitud `-75.20486`. Toca el mapa o arrastra el pin hasta la entrada; revisa la dirección escrita. Añade una referencia de ingreso si hace falta. Clima y feriados son opcionales.
4. Publica. Los datos del evento quedan bloqueados; el propietario puede reemplazar la portada. Los publicados anteriores a la nueva migración no necesitan imagen retroactivamente. Su página pública se encuentra desde el panel y aparece en el catálogo mientras la fecha sea futura.
5. **Personal:** inicia sesión con una segunda cuenta y verifica su correo. Como organizador, añádela por ese correo en la gestión del evento. Solo verá el control de ingreso del evento asignado.
6. **Comprador:** abre el enlace público, preferiblemente en otro navegador. Compra una entrada general con nombre y correo válido. Un correo temporal se rechaza; si Disify no responde, se puede reintentar sin crear la orden.
7. Simula un rechazo: no se emite QR ni se descuenta stock. Vuelve al evento para comenzar otra compra.
8. Simula una aprobación: se descuenta un cupo y aparece un QR descargable en PNG. Guarda el PNG y el enlace del comprobante. La cookie privada dura 30 días desde su creación; borrar cookies o cambiar de navegador impide abrir ese comprobante. El QR descargado sigue siendo la entrada.
9. **Puerta:** entra al evento desde `/panel`, abre la cámara y escanea el PNG desde otro dispositivo, o pega el token visible en el comprobante. El primer ingreso se autoriza y el segundo informa que la entrada ya fue usada.
10. Prueba un token inválido y un QR de otro evento. Desconecta internet: el control no autoriza ingresos sin confirmación del servidor. Si se pierde una respuesta después de registrar el acceso, un reintento mostrará que la entrada ya fue usada.
11. Revoca al personal desde la cuenta del organizador. Su siguiente validación debe ser rechazada, incluso si conserva abierta la página.

La cámara funciona en `localhost` o HTTPS. Una dirección HTTP de la red local no ofrece las mismas garantías del navegador. Las pruebas de permiso denegado se automatizan; verifica también tu cámara física antes de sustentar.

## Semilla opcional

Inicia sesión primero y configura `DEMO_OWNER_EMAIL` con el correo verificado del organizador. Ejecuta:

```powershell
$env:DEMO_OWNER_EMAIL = 'organizador@tu-dominio.com'
npm run seed:demo
```

La semilla crea Noche Andina con fecha de siete días después, a las 20:00 de Lima, 180 entradas y precio S/ 25.00. No crea cuentas ni envía mensajes. Usa un ID fijo y no modifica una semilla existente; si su fecha ya pasó, crea otro evento desde el formulario. La semilla queda en borrador: añade una portada desde gestión y publica. Los datos existentes nunca se sobrescriben.

## Arquitectura y contratos

- Tablas: `events`, `ticket_types`, `orders`, `tickets`, `check_ins`, `event_staff`. Importes enteros en céntimos de PEN; una entrada general por evento y una entrada por orden.
- Estados de evento: `draft`, `published`. Estados de orden: `pending`, `paid`, `rejected`. Una orden pendiente no reserva cupo. Rechazo y aprobación son terminales.
- `src/lib/server/data.ts` centraliza autorización, DTO públicos, comprobantes y llamadas a PostgreSQL. Las páginas protegidas y API verifican la sesión en servidor; el proxy facilita las redirecciones.
- RLS permite lectura pública de eventos futuros publicados y sus tipos de entrada. Órdenes, entradas, tokens, compradores y personal no permiten lecturas directas de clientes.
- Las funciones de escritura solo aceptan `service_role`. Verifican propiedad o membresía dentro de la transacción. Un helper privado resuelve únicamente correos verificados de Supabase Auth; no requiere conceder lectura general del esquema `auth` a `service_role`.
- Publicar bloquea cambios de los datos y del precio/cupo, salvo reemplazar la portada. La función de publicación exige imagen solo para publicaciones nuevas. Los contadores de stock cambian únicamente durante emisión. La aprobación bloquea la orden y actualiza stock condicionalmente; un fallo revierte toda la operación.
- El ID de orden es la clave idempotente. El navegador conserva el intento en `sessionStorage` hasta resolverlo. Reintentos idénticos reutilizan la orden; cambiar comprador o evento con el mismo ID se rechaza.
- El comprobante exige una cookie `HttpOnly`, `SameSite=Strict` y `Secure` bajo HTTPS. Su secreto deriva una credencial independiente por orden; la base solo guarda su hash. El QR contiene un token aleatorio de 256 bits, sin datos personales. No se incluyen secretos en los enlaces.
- Unicidad de `check_ins.ticket_id` impide doble ingreso. La revocación y la validación coordinan bloqueos sobre el evento. Los estados de validación son `accepted`, `used`, `invalid`, `wrong_event`.
- Las API de escritura comprueban `Origin` y validan JSON. No aceptan precios, propietarios o permisos del comprador como fuente de autoridad.

| API | Uso |
| --- | --- |
| `POST /api/events` | Guardar borrador con ID UUID generado por el cliente |
| `GET /api/events/:id`, `PATCH /api/events/:id` | Consultar o editar un borrador propio |
| `DELETE /api/events/:id` | Eliminar evento propio sin ninguna orden, con transacción y bloqueo coordinado con compra |
| `PUT /api/events/:id/cover` | Multipart `cover`; guarda dos WebP y cambia la versión atómicamente |
| `GET /api/events/:id/cover?size=small&v=VERSION` | Variante pequeña; `size=large` para detalle. Borradores solo para su propietario |
| `DELETE /api/events/:id/cover` | Retirar portada de un borrador propio |
| `POST /api/events/:id/publish` | Publicar evento propio completo y futuro |
| `POST /api/events/:id/staff`, `DELETE /api/events/:id/staff` | Añadir o revocar un correo verificado |
| `POST /api/events/:id/check-in` | Validar `{ token }` como propietario o personal |
| `POST /api/orders/session` | Preparar cookie privada de compra |
| `POST /api/orders` | Crear orden con `{ id, eventId, name, email }` |
| `POST /api/orders/:id/simulate` | Simular `{ approve: true/false }` |
| `GET /api/orders/:id` | Comprobante privado del navegador comprador |
| `GET /api/orders/:id/qr` | Descargar PNG de una entrada emitida |
| `POST /api/security/email` | Verificar `{ email }` sin incluirlo en la URL interna |

## Integraciones auxiliares

Nominatim se consulta mediante búsqueda explícita, con caché de una hora, deduplicación, cola limitada y al menos 1,1 segundos entre solicitudes externas. El contacto es opcional; SamiTicket siempre se identifica con User-Agent. Mantén la atribución de OpenStreetMap. `NOMINATIM_SEARCH_URL` permite cambiar proveedor sin modificar código. El límite es por proceso y está pensado para esta demo local; antes de operar varias instancias se requiere coordinación compartida o un proveedor compatible. [Política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

Open-Meteo cubre hoy y los siguientes 14 días (15 fechas), usando las coordenadas del evento en cualquier parte del Perú y zona horaria America/Lima. Consulta condiciones diarias y la hora más próxima al inicio. Incluye recomendaciones para exterior/interior, precipitación, frío y calor; no garantiza el tiempo ni cancela eventos. Open-Meteo y Nager.Date tienen tiempos de espera acotados. Sus fallos no bloquean publicación. El catálogo no sustituye errores de Supabase por datos ficticios.

## Verificación

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Las pruebas normales aplican ambas migraciones a PostgreSQL temporal mediante PGlite. Comprueban permisos, transacciones, idempotencia, agotamiento, revocación y unicidad. PGlite serializa las consultas en una conexión: las llamadas simultáneas verifican invariantes, pero no sustituyen una prueba de carreras entre conexiones remotas.

También se prueban límites HTTP, verificación de correo, cookie privada, bloqueo con pagos deshabilitados, descarga de un PNG real, caché/límite de Nominatim, ingreso manual, permiso de cámara denegado y pérdida de conexión. Los proveedores externos y la cámara se simulan en esas pruebas.

### Prueba remota entre conexiones independientes

Usa un **proyecto Supabase de pruebas descartable**, aplica ambas migraciones y exporta:

```powershell
$env:TEST_SUPABASE_URL = 'https://PROYECTO-DE-PRUEBAS.supabase.co'
$env:TEST_SUPABASE_SERVICE_ROLE_KEY = 'CLAVE-ADMINISTRATIVA-DE-PRUEBAS'
$env:TEST_SUPABASE_PUBLISHABLE_KEY = 'CLAVE-PUBLICA-DE-PRUEBAS'
$env:TEST_DATABASE_CONFIRM = 'samiticket-test-only'
npm run test:remote
```

La suite crea tres usuarios confirmados sin enviar correos, un evento con dos órdenes y tres eventos adicionales para competir entre compra y borrado. Sube portadas WebP temporales al bucket privado. Compite por el último cupo y por el mismo ingreso desde clientes independientes; verifica revocación y denegación pública. Elimina únicamente sus fixtures y archivos al terminar. Si la limpieza falla, informa sus IDs para revisión. Sin esas cuatro variables la prueba remota se omite; nunca reutiliza automáticamente las credenciales de `.env.local`.

Con las mismas variables de prueba, inicia Next.js apuntando al mismo proyecto descartable y ejecuta las pruebas HTTP:

```powershell
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:live
```

Esta suite crea sus propios usuarios y eventos, inicia sesiones sin enviar mensajes y verifica los Route Handlers reales: validaciones, portadas privadas, conversión, publicación, reemplazo, variante por página, compra aprobada e idempotente, comprobante privado, PNG, ingreso único, revocación y eliminación con limpieza en Storage. No utiliza tu sesión personal. Al terminar limpia solo sus fixtures. El proveedor de correo y la base deben estar disponibles.

La aplicación remota de migraciones, los proveedores OAuth y la prueba física de cámara requieren acceso al entorno correspondiente. Los tests locales no demuestran que estén configurados.

Next.js y su configuración de ESLint se actualizaron de 16.3.4 a 16.3.8. La auditoría de producción (`npm audit --omit=dev`) no reportó vulnerabilidades. La auditoría completa conserva cinco avisos en la cadena de herramientas de lint (`braces`, `micromatch`, `fast-glob` y dependientes).

## Límites de esta entrega

No incluye cobros reales, correo transaccional de entradas, invitaciones por enlace, operación offline, devoluciones, edición de datos publicados (salvo portada), Wallet, Redis ni Sentry. El panel muestra las últimas 100 órdenes; sus totales de emisión y stock corresponden al evento completo. Los contadores del panel se actualizan al recargar la página.

## Portadas y recuperación

Sharp corrige orientación y elimina metadatos. No se almacenan originales. Pequeña: lado mayor 640 px, objetivo 150 000 bytes y máximo 180 000. Grande: 1600 px, objetivo 300 000 y máximo 360 000. Sin ampliar originales pequeños ni deformar proporciones. Prueba calidad 82, 78, 74 y 70; si no cumple el máximo a calidad 70, rechaza la subida conservando la portada anterior. SVG, animaciones, archivos corruptos y exceso de píxeles se rechazan comprobando contenido real.

El catálogo/panel pide solo `small`; detalle pide solo `large` con `next/image unoptimized`, sin segunda compresión. El afiche completo se muestra en detalle. El bucket es privado; las API comprueban publicación o propiedad y responden `private, no-store`, sin URLs públicas de Storage ni enlaces firmados. Reemplazar una imagen usa comparación de versión para resolver pestañas simultáneas. Un error de subida no duplica el borrador.

`cover_cleanup` conserva los trabajos de borrado cuando Storage falla. Las mutaciones reintentan trabajos vencidos del evento. Las subidas abandonadas quedan elegibles después de una hora; ejecutar `npm run cleanup:covers` recupera esas subidas y cualquier limpieza pendiente. El comando preserva siempre la versión activa. No hace falta configurar un cron para la demo. Una subida que tarde más de una hora se rechaza antes de activar su versión.

## Ubicación y eliminación

Leaflet usa tiles OSM con caché normal del navegador, atribución y Referer limitado al origen. No se precargan mapas ni se ofrece modo offline. `NEXT_PUBLIC_OSM_TILE_URL` permite otro proveedor compatible con sus propias condiciones; las variables públicas requieren reconstruir/reiniciar Next.js. [Política de tiles](https://operations.osmfoundation.org/policies/tiles/). La búsqueda es explícita con botón o Enter, nunca autocompletado. El pin inicial muestra Perú sin guardar coordenadas. Moverlo conserva la dirección y solicita revisarla; el botón Google Maps abre indicaciones al punto guardado, sin API key.

Solo el propietario puede eliminar borradores o publicados sin órdenes de ningún estado. La confirmación incluye el nombre, irreversibilidad y pérdida del enlace; con órdenes pendientes, pagadas o rechazadas el borrado se bloquea. La transacción elimina personal, entrada general y evento; deja las imágenes en la cola para limpiar después. La compra toma un bloqueo SHARE sobre el evento; el borrado toma UPDATE y revalida órdenes, evitando que ambos se confirmen sobre el mismo evento.

Para demostrarlo, crea un borrador de prueba sin órdenes, abre Eliminar evento y pulsa Conservar evento. Después confirma Eliminar definitivamente: vuelve al panel con Evento eliminado. Repite con un publicado sin órdenes. En un evento con cualquier orden, comprueba que el borrado está bloqueado; el personal nunca verá esta gestión.

## Comprobaciones de esta ampliación

Validación compartida con errores por campo, accesibilidad y foco; punto/coma convertidos exactamente a céntimos; recuperación tras fallo de imagen; conversión nativa con orientación, animación y presupuestos; permisos de portada y limpieza; ambas migraciones en PostgreSQL temporal, conservación de publicados anteriores, bloqueo con cualquier orden y cambios de portada sin editar datos publicados. La suite remota conserva comprobaciones entre conexiones independientes y añade compra contra borrado; requiere la segunda migración aplicada antes de ejecutarse.

Los tests climáticos cubren Lima, Huancayo, Cusco, Arequipa, Piura, Iquitos y Puno, hoy, +14/+15 días, horario nocturno, datos nulos y API caída. Las respuestas reales de Open-Meteo para esas siete ciudades y Nominatim sin contacto también se comprobaron el 16 de octubre de 2026. No equivale a garantizar disponibilidad futura del proveedor.

## Siguientes etapas conservadas

Pagos reales con webhooks (Mercado Pago, Culqi, Izipay o Niubiz), entrega por correo transaccional o WhatsApp, Redis para límites compartidos, Sentry y exportación a Apple/Google Wallet. Esta entrega conserva pagos simulados y control de puerta conectado.

### Resultado comprobado el 16 de octubre de 2026

- Migraci�n 002 confirmada en Supabase demo; `event-covers` privado.
- 69 pruebas locales aprobadas; 2 pruebas de concurrencia remota y 3 pruebas HTTP con base/Storage reales aprobadas. Las 5 remotas se omiten en `npm test` sin habilitaci�n expl�cita.
- Lint, TypeScript y build de producci�n aprobados.
- Navegador real: validaciones/foco, b�squeda con Enter, ciudad, selecci�n del punto, portada, precio con coma, publicaci�n, afiche completo, referencia, Google Maps y aviso de eliminaci�n. Formulario revisado en escritorio y ancho m�vil de 390 px; sin desbordamiento horizontal.
- Mover el pin con clic se comprob� en navegador. El evento `dragend` tiene prueba de componente; arrastre t�ctil en dispositivo f�sico sigue sin comprobarse. C�mara f�sica y proveedores OAuth tampoco se comprobaron en esta ampliaci�n.
- La cuenta, eventos y archivos utilizados para pruebas fueron temporales y se limpiaron.
