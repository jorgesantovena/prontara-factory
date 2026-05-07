# Verifactu — pasos pendientes para envío real (SF-12 / AUDIT-07)

> Estado actual: **payload preparado, sin envío real a AEAT.**
> Lo que hay funcionando hoy:
> - Modelo `VerifactuSubmission` en Postgres.
> - Helper `buildVerifactuPayload` que genera XML según subset del esquema oficial AEAT.
> - Endpoint `POST /api/erp/verifactu-emit` que prepara el payload y lo guarda con `status="prepared"`.
> - Botón **Verifactu** en cada fila de `/facturacion` en **TODOS los verticales** (AUDIT-07: la obligación legal es universal para emisores españoles).
> - Emisor del XML resuelto desde el TENANT (módulo `ajustes` con clave `cif`/`razon_social`), no desde SISPYME.
> - Validación: si el tenant no tiene `cif` configurado, el endpoint devuelve 400 con código `EMISOR_SIN_CIF`.
> - Idempotencia: si ya existe un envío para la factura, no se crea otro.

Para llegar a Verifactu en producción real con AEAT hay 5 piezas que faltan:

## 1. Certificado digital de cada tenant (uno por sociedad)

> Cambio importante (AUDIT-07): el certificado NO es de SISPYME, sino del **tenant** que emite la factura. Cada tenant aporta el suyo cuando se da de alta en producción real con Verifactu.

Cada tenant que vaya a usar Verifactu necesita su propio certificado emitido por la FNMT (o equivalente reconocido por AEAT) instalado de forma que el servidor pueda firmar XML en su nombre.

Diseño multi‑tenant pendiente:

- Una tabla `TenantVerifactuCertificate` en Postgres con `tenantId, certPemB64, keyPemB64, expiresAt, environment ("preproduccion"|"produccion")`.
- UI en `/ajustes` para subir el certificado (campo file que se convierte a base64 server‑side y se guarda cifrado con `PRONTARA_CERT_ENCRYPTION_KEY`).
- Cuando se firme un payload Verifactu, leer el cert del tenant correspondiente, no de env vars globales.

Mientras esto no esté: env vars globales `VERIFACTU_CERT_PEM_B64` y `VERIFACTU_KEY_PEM_B64` sirven para hacer pruebas con UN solo tenant (típicamente SISPYME en pre‑producción).

## 2. Firma XML-DSig del payload

El XML que genera `buildVerifactuPayload` no está firmado. AEAT exige firma `XAdES-BES` con el certificado del emisor.

Librerías candidatas en Node:

- `xml-crypto` (mantenida, OpenSSL bindings).
- `node-signpdf` + `xades-js` (algo más artesanal pero funciona).

El proceso es:

1. Cargar cert y key desde env vars.
2. Calcular el `DigestValue` del XML canonicalizado (C14N).
3. Generar el `SignedInfo` y firmarlo con la key.
4. Insertar el bloque `<Signature>` dentro del XML.
5. Validar la firma localmente antes de enviar.

## 3. URL real del web service AEAT

Endpoints oficiales (mayo 2026):

- **Preproducción** (testing): `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`
- **Producción**: `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`

El método SOAP es `RegFactuSistemaFacturacion`. Hay que envolver el XML firmado en un sobre SOAP correcto.

Variables de entorno sugeridas:

- `VERIFACTU_WS_URL` (con default a preproducción).
- `VERIFACTU_WS_TIMEOUT_MS` (default 30000).

## 4. Procesar respuesta y construir QR

La respuesta de AEAT incluye:

- **CSV de la huella**: cadena alfanumérica que identifica el envío. Hay que guardarla en `VerifactuSubmission.csvHuella`.
- **Datos para el QR**: URL del tipo `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=...&numserie=...&fecha=...&importe=...`. Guardar en `qrPayload`.

El QR resultante hay que añadirlo al PDF de la factura (modificar `generateJustificantePdf` o crear un `factura-pdf` análogo). Visualmente: cuadrado en la esquina inferior con leyenda "Factura verificable en Sede Electrónica AEAT".

## 5. Tests con sandbox AEAT

Antes de producción:

1. Dar de alta en el sandbox de AEAT: <https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP>.
2. Emitir 5–10 facturas de prueba con datos reales de SISPYME.
3. Verificar que el CSV devuelto se guarda correctamente.
4. Verificar el QR generado escaneando con el móvil — debe llevar a la sede electrónica AEAT y mostrar la factura.
5. Probar casos edge: importe = 0, factura rectificativa, devolución.

Solo cuando los 5 pasos del sandbox sean OK, cambiar `VERIFACTU_WS_URL` a producción.

## Estimación

- Punto 1 (certificado): trámite externo, días.
- Puntos 2 + 3 + 4 (firma + envío + respuesta): ~3–5 días de desarrollo serio.
- Punto 5 (tests sandbox): 1–2 días.

Total realista: **2 semanas** desde que llegue el certificado.

## Mientras tanto

El operador puede usar el botón **Verifactu** en `/facturacion` para preparar los XML — quedarán en `VerifactuSubmission` con status `prepared`. Cuando esté lista la integración real, se procesarán en lote los pendientes con un script que firme + envíe + actualice estado.
