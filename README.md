# SamiTicket

MVP de eventos locales con Next.js, Supabase, entradas QR y control de ingreso en línea. Admite simulación local y una integración de Mercado Pago en Prueba con un vendedor ficticio de Perú.

## Preparación local

Recomendado: Node.js 24.15 o superior dentro de la rama 24, y npm. No se necesita PostgreSQL local para las pruebas normales.

1. Ejecuta `npm ci`.
2. Crea un proyecto Supabase de **demostración**.
3. Ejecuta las migraciones de `supabase/migrations` en orden, como administrador en el SQL Editor. Omite las que ya estén aplicadas. La 002 añade portadas y eliminación; la 003 añade Mercado Pago Prueba y reservas; la 004 conserva aprobaciones ante avisos atrasados; la 005 impide que el reembolso de otro intento revoque la entrada válida. Las 003–005 admiten repetición y conservan datos. Si `revoked_at` ya existe, usa la versión actualizada de la 003. No elimines columnas ni tablas para resolver ese aviso.
4. Copia `.env.example` a `.env.local` y configura:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU-CLAVE-PUBLICA
SUPABASE_SERVICE_ROLE_KEY=TU-CLAVE-SERVICE-ROLE
DEMO_PAYMENTS_ENABLED=true
NOMINATIM_CONTACT=TU-CORREO-O-URL-DE-CONTACTO
```

`SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor. Nunca la expongas con `NEXT_PUBLIC_`. Reinicia Next.js después de cambiar variables. Para comprar debe estar habilitada la simulación local o Mercado Pago Prueba; la simulación sigue exigiendo `DEMO_PAYMENTS_ENABLED=true`.

5. En Supabase Auth, añade `http://localhost:3000/auth/callback` como Redirect URL. Configura Site URL como `http://localhost:3000`. Activa correo/Magic Link y, si se usan, Google, Facebook y Azure/Microsoft con sus credenciales y callbacks propios de Supabase.
6. Ejecuta `npm run dev` y abre [SamiTicket local](http://localhost:3000).

La compra no envía correos. El login con Magic Link sí utiliza Supabase Auth. Disify recibe el correo del comprador para verificarlo antes de crear la orden.

## Mercado Pago: Checkout Pro en Prueba

Esta integración usa una cuenta vendedora ficticia de Perú. Verifica su identidad con Mercado Pago antes de operar y bloquea vendedores reales. No basta con cambiar `MP_ENVIRONMENT` para cobrar dinero real. Los datos de tarjeta se introducen en Checkout Pro, fuera de SamiTicket.

1. En [Tus integraciones](https://www.mercadopago.com.pe/developers/panel/app), abre tu aplicación de Checkout Pro. Obtén las credenciales de **Prueba** y el User ID de su vendedor ficticio. No uses la credencial productiva de tu cuenta personal. Configura en `.env.local`:

   ```dotenv
   MP_PAYMENTS_ENABLED=true
   MP_ENVIRONMENT=test
   MP_TEST_SELLER_ID=ID-DEL-VENDEDOR-FICTICIO
   MP_ACCESS_TOKEN=CREDENCIAL-DE-PRUEBA
   MP_WEBHOOK_SECRET=CLAVE-COMPLETA-DE-WEBHOOKS
   APP_URL=https://TU-TUNEL.trycloudflare.com
   ```

   `MP_APP_ID`, `MP_TEST_APP_ID` y `MP_PUBLIC_KEY` documentan la aplicación; este Checkout Pro redirigido no necesita exponer la clave pública en el navegador. Cuando `MP_PAYMENTS_ENABLED=true`, las órdenes nuevas usan Mercado Pago; las órdenes de simulación anteriores mantienen su modo.

2. Ejecuta `npm run dev` en una terminal y `node scripts/mp-webhook-gateway.mjs` en otra. El gateway escucha solo en `127.0.0.1:3101`. Con [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/), abre un túnel hacia `http://127.0.0.1:3101`. Usa su origen HTTPS como `APP_URL`; reinicia Next.js al cambiarlo. No apuntes el túnel a la aplicación completa en el puerto 3000.
3. En Webhooks de la aplicación, configura únicamente **Prueba**, tópico `payment` (puede mostrarse como **Pagos (legacy)**), URL `APP_URL/api/payments/mercadopago`. Copia la clave secreta completa a `MP_WEBHOOK_SECRET`. Si el campo está enmascarado en Prueba, revisa **Modo productivo** en la misma pantalla. En SamiTicket Piloto esa pestaña permitió copiar la clave de la aplicación sin activar cobros ni guardar una URL de producción. Reinicia Next.js después de guardarla. Mientras falte la clave, puedes abrir Checkout Pro y pulsar **Consultar pago** al volver. El gateway solo acepta notificaciones con una firma válida y una clave configurada.
4. Compra desde `http://localhost:3000`. El comprobante ofrece **Pagar con Mercado Pago** y **Consultar pago**. Inicia sesión en Checkout Pro con un comprador ficticio distinto del vendedor; encuentra su usuario y contraseña en **Cuentas de prueba → Comprador**. Usa exclusivamente las [tarjetas oficiales de prueba para Perú](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases). `APRO` permite probar aprobación y `OTHE` rechazo, según la documentación vigente del proveedor. Nunca introduzcas una tarjeta real.
5. Regresa a SamiTicket con el botón del proveedor. El gateway redirige a `localhost:3000/pedido/:id?retorno=mercadopago` sin reenviar datos del pago. Si la orden privada sigue pendiente, el comprobante consulta automáticamente a Mercado Pago una vez. También puedes usar **Consultar pago** para reintentar. La consulta y el webhook firmado verifican vendedor, referencia, PEN e importe antes de emitir el QR. Un rechazo permite volver a pagar dentro de la reserva.
6. Descarga el PNG y valida dos veces en puerta: solo el primer ingreso se autoriza. El comprobante sigue siendo privado del navegador que inició la compra; abrir su URL en otro perfil no concede acceso.

Para obtener `200` en **Simular notificación**, usa como **Data ID** el identificador de un pago de prueba de esa compra. El simulador envía un aviso y no crea el pago. Un aviso con firma válida y un ID inexistente, como `123456`, devuelve `404`. Una firma ausente o inválida devuelve `401`.

Las reservas duran hasta 30 minutos o hasta el inicio del evento, lo que ocurra primero. Expiran por fecha sin tareas programadas; no incrementan entradas vendidas. Los pagos aprobados atrasados se reconcilian con el stock actual. Si ya no hay cupo, comenzó el evento o existe otra entrada pagada para la orden, se solicita un reembolso de prueba idempotente y no se emite una entrada adicional. Los fallos dejan el reembolso pendiente y el webhook o la consulta pueden reintentarlo. Un reembolso completo del pago que emitió la entrada revoca su QR; el reembolso de otro intento no lo revoca.

En esta etapa se excluyen medios diferidos `ticket` y `atm`, por lo que no se ofrece PagoEfectivo. Los demás medios visibles dependen de lo que Checkout Pro habilite para el vendedor ficticio; no se promete disponibilidad de Yape o Plin en Prueba. Stripe y pagos a las cuentas particulares de cada organizador no están conectados. El receptor es el vendedor ficticio configurado, sin liquidaciones ni comisiones de marketplace.

El túnel gratuito es temporal: al reiniciarlo cambia la URL y debes actualizar `APP_URL`, Webhooks y crear otra compra. Los archivos de revisión, cookies y credenciales de prueba van en `.impeccable/review/`, ignorado por Git. Para detener la demo, cierra `cloudflared` y el gateway. Para volver a la simulación local, usa `MP_PAYMENTS_ENABLED=false` y `DEMO_PAYMENTS_ENABLED=true`.

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
- Estados de evento: `draft`, `published`. Estados de orden: `pending`, `paid`, `rejected`. Las órdenes de simulación no reservan cupo; las de Mercado Pago Prueba tienen una reserva temporal en `mp_checkouts`. Los intentos del proveedor se registran por separado en `mp_payments`, con RLS y acceso exclusivo del servidor. Una notificación de rechazo no impide volver a pagar durante la reserva.
- `src/lib/server/data.ts` centraliza autorización, DTO públicos, comprobantes y llamadas a PostgreSQL. Las páginas protegidas y API verifican la sesión en servidor; el proxy facilita las redirecciones.
- RLS permite lectura pública de eventos futuros publicados y sus tipos de entrada. Órdenes, entradas, tokens, compradores y personal no permiten lecturas directas de clientes.
- Las funciones de escritura solo aceptan `service_role`. Verifican propiedad o membresía dentro de la transacción. Un helper privado resuelve únicamente correos verificados de Supabase Auth; no requiere conceder lectura general del esquema `auth` a `service_role`.
- Publicar bloquea cambios de los datos y del precio/cupo, salvo reemplazar la portada. La función de publicación exige imagen solo para publicaciones nuevas. Los contadores de stock cambian únicamente durante emisión. La aprobación bloquea la orden y actualiza stock condicionalmente; un fallo revierte toda la operación.
- El ID de orden es la clave idempotente. El navegador conserva el intento en `sessionStorage` hasta resolverlo. Reintentos idénticos reutilizan la orden; cambiar comprador o evento con el mismo ID se rechaza.
- El comprobante exige una cookie `HttpOnly`, `SameSite=Strict` en simulación y `SameSite=Lax` al usar el retorno de Mercado Pago; es `Secure` bajo HTTPS. Su secreto deriva una credencial independiente por orden; la base solo guarda su hash. El QR contiene un token aleatorio de 256 bits, sin datos personales. No se incluyen secretos en los enlaces.
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
| `POST /api/orders/:id/checkout` | Crear o reutilizar Checkout Pro Prueba; exige cookie privada y mismo origen |
| `POST /api/orders/:id/refresh` | Consultar y reconciliar pagos de la orden privada desde Mercado Pago |
| `POST /api/payments/mercadopago` | Webhook: HMAC-SHA256 y consulta del pago en servidor antes de confirmar |
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

Las pruebas normales aplican las migraciones a PostgreSQL temporal mediante PGlite, incluidas las 003–005 dos veces para comprobar que admiten repetición. Comprueban permisos, transacciones, idempotencia, agotamiento, revocación, reembolsos atrasados y unicidad. PGlite serializa las consultas en una conexión: las llamadas simultáneas verifican invariantes, pero no sustituyen una prueba de carreras entre conexiones remotas.

También se prueban límites HTTP, verificación de correo, cookie privada, bloqueo con pagos deshabilitados, descarga de un PNG real, caché/límite de Nominatim, ingreso manual, permiso de cámara denegado y pérdida de conexión. Los proveedores externos y la cámara se simulan en esas pruebas.

### Prueba remota entre conexiones independientes

Usa un **proyecto Supabase de pruebas descartable**, aplica las cinco migraciones y exporta:

```powershell
$env:TEST_SUPABASE_URL = 'https://PROYECTO-DE-PRUEBAS.supabase.co'
$env:TEST_SUPABASE_SERVICE_ROLE_KEY = 'CLAVE-ADMINISTRATIVA-DE-PRUEBAS'
$env:TEST_SUPABASE_PUBLISHABLE_KEY = 'CLAVE-PUBLICA-DE-PRUEBAS'
$env:TEST_DATABASE_CONFIRM = 'samiticket-test-only'
npm run test:remote
```

La suite crea tres usuarios confirmados sin enviar correos y eventos temporales. Sube portadas WebP al bucket privado. Compite por el último cupo y por el mismo ingreso desde clientes independientes; verifica reservas MP, aprobaciones repetidas, reembolsos ajenos, revocación y denegación pública. Las pruebas RPC de MP usan identificadores ficticios: no realizan pagos en Mercado Pago. Elimina únicamente sus fixtures y archivos al terminar. Si la limpieza falla, informa sus IDs para revisión. Sin esas cuatro variables la prueba remota se omite; nunca reutiliza automáticamente las credenciales de `.env.local`.

Con las mismas variables de prueba, inicia Next.js apuntando al mismo proyecto descartable, con `MP_PAYMENTS_ENABLED=false` y `DEMO_PAYMENTS_ENABLED=true`, y ejecuta las pruebas HTTP de simulación local:

```powershell
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:live
```

Esta suite crea sus propios usuarios y eventos, inicia sesiones sin enviar mensajes y verifica los Route Handlers reales: validaciones, portadas privadas, conversión, publicación, reemplazo, variante por página, compra aprobada e idempotente, comprobante privado, PNG, ingreso único, revocación y eliminación con limpieza en Storage. No utiliza tu sesión personal. Al terminar limpia solo sus fixtures. El proveedor de correo y la base deben estar disponibles.

La aplicación remota de migraciones, los proveedores OAuth y la prueba física de cámara requieren acceso al entorno correspondiente. Los tests locales no demuestran que estén configurados.

Next.js y su configuración de ESLint se actualizaron de 16.3.4 a 16.3.8. La comprobación histórica de octubre no reportó vulnerabilidades de producción; los avisos encontrados en noviembre se detallan en «Interfaz nocturna y componentes».

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

## Interfaz nocturna y componentes

El catálogo y el detalle comparten una base carbón, texto cálido y acento coral. Manrope se usa en títulos e Inter en lectura, servidos por `next/font`. Las portadas reales conservan el protagonismo; si no hay eventos futuros publicados se muestra un estado vacío, sin inventar ventas disponibles.

Los controles de `src/components/ui` proceden de shadcn (Base UI, estilo Mira) y del registro oficial de [Cult UI](https://www.cult-ui.com/docs/components/). `components.json` registra `@cult-ui`. Catálogo y panel usan Cutout Card, con datos y acciones siempre visibles; el detalle conserva el afiche completo y ofrece acceso fijo a las entradas en móvil.

LightBoard muestra subtítulos debajo del hero con luz roja y botón de pausa. Halo Input y Textarea mantienen etiquetas, errores y foco; Halo Dropzone selecciona una portada y conserva la anterior si el reemplazo es inválido. La conversión y subida WebP siguen realizándose en el servidor al guardar. Halo Segmented selecciona interior o exterior. Halo Card presenta el acceso y el pronóstico, acompañado por SVG según su condición diaria.

Gradient Button Group filtra Todos, Disponibles y Agotados, combinado con la búsqueda por nombre, ciudad, local o categoría, que tolera tildes. Los botones responden con color al hover y al pulsar. Halo Progress muestra cargas indeterminadas, incluido un indicador global que espera todas las solicitudes pendientes. Dynamic Island muestra avisos reales; los errores persisten hasta cerrarse y conservan los errores junto a cada campo.

El confeti aparece una sola vez después de crear correctamente un evento y llegar a su panel, nunca tras una edición o un fallo. La preferencia de movimiento reducido elimina el confeti y mantiene un letrero estático; los efectos continuos se suspenden fuera de pantalla y con la pestaña oculta. No se inventan porcentajes de avance.

Las reglas de producto y diseño están en `PRODUCT.md` y `DESIGN.md`. El tema reside en `src/app/globals.css`. Los formularios mantienen su validación y contratos de servidor; el rediseño no requiere migraciones nuevas. La revisión visual usa eventos temporales rotulados como pruebas y los elimina al terminar.

La revisión visual independiente de esta ampliación quedó aprobada, sin correcciones materiales pendientes. Sus observaciones y alcance constan en `.impeccable/surfaces/src-app-page-tsx.md`; los avisos documentados del detector no equivalen a errores nuevos de ejecución.

Verificación del 18 de noviembre de 2026: 80 pruebas locales aprobadas; las cinco pruebas remotas siguen requiriendo habilitación explícita. Lint, TypeScript y build de producción aprobados. Catorce capturas: catálogo, detalle, login, creación y panel en 1440 px y 390 px, más portada/clima, celebración, error y movimiento reducido. Sin desbordamiento ni errores del navegador. Se comprobaron filtros combinados, selección de portada, interior/exterior, creación real con confeti sobre el panel, conservación del formulario ante fallo y cierre de avisos. Los fixtures temporales se limpiaron; se confirmó que no quedaban eventos ni cuentas de revisión. Cámara física y OAuth real no se probaron en este rediseño.

Dependencias pendientes: `npm audit --omit=dev` reportó una alerta crítica en Next.js 16.3.8, una alta en Zod y cuatro moderadas en la cadena de herramientas de shadcn. Este rediseño conserva las versiones del framework; su actualización y verificación requieren una entrega separada. No se ejecutó `npm audit fix --force`.

## Siguientes etapas conservadas

Pasar de Mercado Pago Prueba a producción requiere una entrega y validación propias, incluida la conexión de cuentas de organizadores si se adopta marketplace. Se conservan Culqi, Izipay o Niubiz, entrega por correo transaccional o WhatsApp, Redis para límites compartidos, Sentry y exportación a Apple/Google Wallet. Esta entrega conserva control de puerta conectado y no procesa dinero real.

### Resultado comprobado el 16 de octubre de 2026

- Migración 002 confirmada en Supabase demo; `event-covers` privado.
- 69 pruebas locales aprobadas; 2 pruebas de concurrencia remota y 3 pruebas HTTP con base/Storage reales aprobadas. Las 5 remotas se omiten en `npm test` sin habilitación explícita.
- Lint, TypeScript y build de producción aprobados.
- Navegador real: validaciones/foco, búsqueda con Enter, ciudad, selección del punto, portada, precio con coma, publicación, afiche completo, referencia, Google Maps y aviso de eliminación. Formulario revisado en escritorio y ancho móvil de 390 px; sin desbordamiento horizontal.
- Mover el pin con clic se comprobó en navegador. El evento `dragend` tiene prueba de componente; arrastre táctil en dispositivo físico sigue sin comprobarse. Cámara física y proveedores OAuth tampoco se comprobaron en esta ampliación.
- La cuenta, eventos y archivos utilizados para pruebas fueron temporales y se limpiaron.
