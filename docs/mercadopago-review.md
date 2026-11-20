# Mercado Pago Integration Review

**Scope**: security; integración exclusiva de Prueba.
**API detected**: Checkout Preferences y consulta/reembolso de Payments API mediante SDK oficial. No se reciben tarjetas en SamiTicket.
**Products detected**: Checkout Pro vía Preferences API, vendedor ficticio de Perú.
**Files analyzed**: `src/lib/server/mercadopago.ts`, rutas de órdenes y pagos, comprobante, acciones de pago, gateway y migraciones 003–005.

## CRITICAL

- Mercado Pago confirmó una compra aprobada de Checkout Pro realizada por el comprador ficticio. La orden quedó pagada con una sola entrada después de reconciliarla desde SamiTicket. El simulador del proveedor reportó `502`; el historial y los registros disponibles no permiten ubicar el origen. La entrega automática desde Mercado Pago sigue pendiente.
- El proyecto mantiene alertas conocidas de dependencias, incluida Next.js 16.3.8. Resolverlas y repetir verificación antes de una entrega productiva. Esta entrega no habilita cobros reales.

## WARNINGS

- El túnel gratuito es temporal. Su URL cambia al reiniciarlo; actualizar `APP_URL`, Webhooks y crear otra compra.
- El MCP devuelve una vista previa de la clave. En SamiTicket Piloto, el panel permitió copiarla desde **Modo productivo** aunque **Modo de prueba** la mostraba enmascarada. La notificación contiene un HMAC en `x-signature` calculado con esa clave.
- El navegador automatizado recibió `403` en la página del proveedor. El comprador completó la compra de prueba en su propio navegador.
- Las seis pruebas remotas optativas necesitan un entorno explícito. Se ejecutó el caso de concurrencia de Mercado Pago en Supabase de demostración y pasó. Las pruebas HTTP de simulación requieren `MP_PAYMENTS_ENABLED=false` y `DEMO_PAYMENTS_ENABLED=true`.
- El checkout requiere importe positivo. No incluye medios diferidos, Stripe, liquidaciones ni conexión de cuentas de organizadores.

## PASS

- API del proveedor confirmó vendedor `test_user` y país MPE. Se creó una preferencia real de Prueba con precio de la base y referencia de la orden.
- El servidor bloquea cuentas reales. Las claves permanecen en `.env.local`, ignorado por Git; el código sensible usa `server-only`.
- Reservas, emisión, unicidad y revocación se ejecutan en PostgreSQL. Los avisos atrasados no degradan una aprobación; el reembolso de otro intento no revoca la entrada válida.
- La creación del checkout y el reembolso utilizan claves idempotentes estables. El webhook consulta el pago canónico y verifica importe, PEN, vendedor y orden.
- El receptor público solo expone el retorno permitido y webhooks firmados. Se comprobaron 404 en `/`, `/login` y `/api/events`, y 303 hacia el comprobante local. Con la clave configurada, las firmas alteradas reciben 401. Dos reenvíos firmados desde SamiTicket para la compra aprobada recibieron 200 y conservaron una sola entrada.
- Comprobante privado verificado en navegador aislado: acceso 200 con cookie y 403 desde otro contexto. Escritorio y móvil de 390 px sin errores ni desbordamiento.
- En una orden temporal de Prueba, estados de pago inyectados en Supabase permitieron verificar por HTTP rechazo sin QR, descarga de PNG con cookie privada, un solo ingreso ante dos escaneos simultáneos y revocación tras el reembolso. La compra aprobada del comprador y el intento rechazado (`189567726611`, `cc_rejected_other_reason`) se confirmaron con la API de Mercado Pago. La prueba de puerta no usó su entrada.
- 95 pruebas locales aprobadas. Se probaron las migraciones 003–005 repetidas, firmas alteradas y vencidas, importes, permisos, reintentos, simulación local de estados `mp_test` (`approved`, `in_process`, `rejected`, `refunded`) y reembolsos fuera de orden. El caso remoto confirmó que el reembolso de otro intento conserva el QR. La API real creó y reutilizó una preferencia. La consulta directa confirmó que la orden seguía pendiente y rechazó una sesión de otro navegador.
- Evento, orden, portadas y propietario de revisión eliminados. La búsqueda del proveedor confirmó cero pagos antes de limpiar.

## Quality Standards

Not requested for this scope. No se ejecutaron `quality_checklist`, `quality_evaluation` ni homologación. Las preferencias no se consideran una integración heredada por usar esta API.

## Security checklist (cross-cutting)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Access token en entorno del servidor | Implemented | `src/lib/server/mercadopago.ts:19`; búsqueda sin credenciales fuera de archivos ignorados |
| 2 | Entorno ignorado; ejemplo permitido | Implemented | `.gitignore`, `.env.example` |
| 3 | HMAC-SHA256 de `x-signature` | Implemented; entrega del proveedor pendiente | `src/lib/server/mercadopago.ts:48`, `scripts/mp-webhook-gateway.mjs:23` |
| 4 | URLs externas HTTPS | Implemented | `src/lib/server/mercadopago.ts:38`; retorno HTTP solo hacia localhost para esta demo |
| 5 | Confirmación mediante consulta del proveedor | Implemented; pago completo pendiente | `src/lib/server/mercadopago.ts:119`; retorno sin confiar en parámetros de estado |
| 6 | Claves de idempotencia estables | Implemented | `src/lib/server/mercadopago.ts:98`, reembolso y RPC de checkout |
| 7 | Referencia externa en preferencia | Implemented | `src/lib/server/mercadopago.ts:101` |
| 8 | Credenciales ficticias fuera del repositorio | Implemented | `.env.local` y artefactos de revisión ignorados; flags deshabilitados por defecto en `.env.example` |
| 9 | Retorno `init_point` validado | Implemented | `src/lib/server/mercadopago.ts:109`; HTTPS y lista de hosts permitidos |

## Recommendations

1. Confirmar una notificación de Prueba enviada por Mercado Pago con la clave ya configurada.
2. Completar compra aprobada y rechazada con comprador y tarjeta ficticios. Confirmar webhook, consulta, PNG y doble ingreso.
3. Diseñar producción y marketplace como entrega separada, con dependencias actualizadas, límites compartidos, monitoreo y recuperación de comprobantes.

**Summary**: Official quality: not requested. Los nueve controles tienen implementación local; la configuración y prueba externa de extremo a extremo siguen pendientes.

---

## Implementation Report

### Verified

- [x] Preferencia creada en Mercado Pago con vendedor ficticio MPE y precio del servidor.
- [x] Validación HMAC, coincidencia del pago y operaciones idempotentes implementadas y probadas localmente.
- [x] Reservas, QR único y protección contra avisos atrasados/reembolsos ajenos en SQL.
- [x] Comprobante privado, interfaz móvil y gateway limitado comprobados.
- [x] Pruebas locales, lint, tipos, build y validación del plugin aprobados; fixtures temporales limpios.

### Needs attention

- [x] Configurar `MP_WEBHOOK_SECRET` completo desde la pestaña **Modo productivo** del panel de Webhooks.
- [x] Confirmar aplicación remota de `supabase/migrations/202611190005_payment_refund_guard.sql` con un caso aislado en Supabase.
- [x] Confirmar el pago ficticio de Checkout Pro en la API del proveedor y emitir una sola entrada.
- [x] Verificar descarga privada, doble escaneo y revocación por HTTP con una orden temporal.
- [ ] Verificar la entrega de una notificación enviada por el proveedor y un rechazo iniciado en Checkout Pro.
- [ ] Ejecutar pruebas remotas optativas; sus casos SQL no sustituyen una compra en Checkout Pro.

### Blockers (must fix before production)

- [ ] El código está limitado deliberadamente a Prueba; no existe entrega productiva ni liquidación a organizadores.
- [ ] Resolver alertas de dependencias y completar validación operativa/comercial antes de habilitar dinero real.

### Next steps

1. Revisar la respuesta del simulador de Webhooks de Prueba.
2. Completar el guion de Mercado Pago Prueba documentado en `README.md`.
3. Repetir `mp-review` después de las verificaciones externas.

### Resources used

- Local: inspección, pruebas Vitest/PGlite, SDK oficial, build y navegador Playwright aislado.
- MCP: documentación de Mercado Pago, configuración del webhook de Prueba y creación de comprador ficticio.
- Oficial: [Notificaciones](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/payment-notifications), [compras de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).
- Skill: `mercadopago:mp-review` v1.0.0, alcance de seguridad.

**Scores**: official quality: N/A; 9/9 controles implementados localmente, pendientes configuración y verificación externa. **Verdict**: Needs fixes — únicamente Prueba, compra completa sin confirmar.
