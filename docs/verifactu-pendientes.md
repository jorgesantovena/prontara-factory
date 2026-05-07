# Verifactu — pasos pendientes para envío real (SF-12)

> Estado actual: **payload preparado, sin envío real a AEAT.**
> Lo que hay funcionando hoy:
> - Modelo `VerifactuSubmission` en Postgres.
> - Helper `buildVerifactuPayload` que genera XML según subset del esquema oficial AEAT.
> - Endpoint `POST /api/erp/verifactu-emit` que prepara el payload y lo guarda con `status="prepared"`.
> - Botón **Verifactu** en cada fila de `/facturacion` (solo vertical software-factory).
> - Idempotencia: si ya existe un envío para la factura, no se crea otro.

Para llegar a Verifactu en producción real con AEAT hay 5 piezas que faltan:

## 1. Certificado digital de la sociedad

Hay que tener el certificado de **SISPYME, S.L.** (CIF B33047580) emitido por la FNMT o equivalente, instalado de forma que el servidor pueda firmar XML.

En Vercel serverless lo más práctico es:

- Convertir el certificado a base64.
- Guardarlo en una env var: `VERIFACTU_CERT_PEM_B64`.
- Guardar también la clave privada: `VERIFACTU_KEY_PEM_B64`.
- En runtime, decodificar y pasar a la librería de firma.

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
