# Piloto de SamiTicket en Huancayo

Valida si los organizadores de peñas, fiestas y locales del Valle del Mantaro pueden vender y controlar el ingreso con menos trabajo. Empieza con cinco conversaciones y busca dos organizadores con un evento real de 50 a 500 personas y fecha definida.

## Contacto con organizadores

Mensaje para WhatsApp:

> Hola, [nombre]. Estoy probando SamiTicket para eventos en Huancayo. La idea es compartir un enlace de venta y controlar el ingreso con QR desde el celular. ¿Tienes 15 minutos esta semana para ver una demo y contarme cómo vendes hoy? La demo usa pagos simulados. Si te sirve, podemos conversar sobre probarlo en un evento próximo.

Pide fecha, aforo, precio de la entrada, medios de pago más usados y cómo verifican los cobros en puerta. Pregunta cuánto tiempo toma esa tarea y quién resuelve los cambios y devoluciones. Cierra con una pregunta concreta: «Si el flujo funciona y conoces tu coste total por venta, ¿qué evento probarías con nosotros?».

| Organizador | Evento y fecha | Aforo y precio | Mayor problema hoy | Demo / próximo paso |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## Demostración de 15 minutos

1. En 3 minutos, pregunta cómo vende y registra ingresos hoy.
2. En 4 minutos, abre un evento de prueba con portada, precio y ubicación. Muéstrale el enlace que compartiría por WhatsApp.
3. En 4 minutos, compra sin cuenta con pago simulado y descarga el QR. Valídalo dos veces para mostrar que admite un solo ingreso. Usa dos pantallas, internet y una cámara; el ingreso manual sirve si falla el permiso de cámara.
4. En 4 minutos, muestra el panel, presenta el coste como hipótesis y registra su próximo evento y objeciones. Sigue el [guion técnico en README](README.md#guion-de-demostración) para preparar el ensayo.

## Cotización de pagos

Empieza por Mercado Pago para probar la conexión de vendedores y por Culqi para contrastar coste y cobertura local. [Mercado Pago Marketplace para Perú](https://www.mercadopago.com.pe/developers/es/docs/split-payments/split-1-1/overview), [tarifario Culqi](https://culqi.com/precios/).

> Hola. Estamos preparando SamiTicket, una plataforma para eventos de 50 a 500 asistentes en Perú. Cada organizador debe cobrar en su propia cuenta de comercio. ¿Qué producto permite conectar varias cuentas y cobrar una comisión de plataforma sin recibir todos los fondos? ¿Qué medios admite ese producto en Perú: tarjeta, Yape, Plin y PagoEfectivo? Por favor, indiquen el coste total por medio para compras de S/15, S/25 y S/40, incluidos mínimos y cargos fijos, y el importe neto que recibiría el organizador. ¿Qué requisitos necesita el organizador, cuándo se liberan los fondos y cómo se gestionan cancelaciones, devoluciones y contracargos? ¿Qué medios y escenarios podemos ensayar con cuentas de prueba?

En Mercado Pago Developers, crea una aplicación de pagos online con Checkout Pro y modelo Marketplace. Prepara dos vendedores de prueba para comprobar que los cobros de cada evento quedan asociados al vendedor correcto, y un comprador de prueba. Usa Perú para las cuentas de prueba. Comparte el estado de la configuración y la cotización sin incluir claves privadas ni contraseñas. [Crear la aplicación](https://www.mercadopago.com.pe/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration), [cuentas de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/test-accounts).

## Precio y decisión

Prueba publicación gratis y una comisión SamiTicket del 2% por entrada pagada, con tope de S/3 por entrada. Presenta el coste de la pasarela por separado al organizador y el precio final antes de pagar al comprador. Si se venden 200 entradas de S/25, se cobran S/5.000 y SamiTicket ingresa S/100 brutos antes de sus gastos. Contrasta ese ingreso con las horas de incorporación y soporte por evento. Cotiza la asistencia presencial como servicio aparte.

- Usa los ejemplos de S/15, S/25 y S/40 para comparar coste total y neto real con el proveedor y con cualquier cotización que el organizador acepte compartir.
- Pasa del ensayo a la primera venta real cuando un organizador haya elegido fecha y aceptado el coste, la pasarela confirme abonos y medios para su cuenta, y el flujo de prueba cubra pago aprobado, rechazado, devolución, reintento y último cupo.
- Acompaña el primer evento. Registra ventas confirmadas, incidencias en compra y puerta, horas de soporte y si el organizador agenda otro evento. Usa esos datos para ajustar la comisión antes de ampliar el piloto.
