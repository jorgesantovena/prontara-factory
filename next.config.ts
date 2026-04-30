import type { NextConfig } from "next";

/**
 * Security headers — protección base contra clickjacking, MIME sniffing,
 * referrer leaks y XSS en navegadores modernos (SEC-1).
 *
 * Notas sobre la CSP:
 *   - `script-src 'self' 'unsafe-inline' 'unsafe-eval'` permite scripts
 *     inline porque Next.js inyecta scripts hidratantes con hash dinámico
 *     que rompen una CSP estricta. Para subir a `'strict-dynamic'` con
 *     nonce hay que tocar el proxy y app/layout — no es trivial.
 *   - `style-src 'self' 'unsafe-inline'` permite los estilos inline que
 *     usamos en componentes (sin Tailwind). Sin esto se rompe la UI.
 *   - `img-src` incluye `data:` y `blob:` para previews de upload.
 *   - `connect-src` incluye Stripe; Resend y Anthropic se acceden solo
 *     desde servidor (API routes), no desde browser.
 *   - `frame-ancestors 'none'` previene clickjacking embebiendo el sitio.
 *   - `frame-src` permite Stripe Checkout cuando se redirige al iframe.
 *   - HSTS con preload activo siempre — Vercel sirve por HTTPS, en local
 *     con HTTP el navegador lo ignora.
 */
const securityHeaders = [
  // Anti-clickjacking. Equivalente a frame-ancestors en CSP, pero
  // X-Frame-Options sigue siendo respetado por más navegadores antiguos.
  { key: "X-Frame-Options", value: "DENY" },

  // Anti MIME-sniffing: el navegador NO intenta adivinar el content-type
  // de respuestas — usa el declarado por el servidor.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // No filtrar más Referer del estrictamente necesario.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Cierra APIs del navegador que no usamos (cámara, micro, geo, etc.).
  // Si en algún momento usas alguna, edita esta lista.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },

  // HSTS: forzar HTTPS por 2 años + preload list opt-in.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // CSP — controla qué orígenes pueden cargar scripts, imágenes, etc.
  // Si alguna integración nueva (analytics, fonts externas) deja de
  // funcionar, hay que añadir su origen aquí, NO desactivar la CSP.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Paquetes que NO deben ser bundled por Webpack/Turbopack y se cargan
  // como módulos Node nativos en runtime serverless. Necesario para libs
  // que usan APIs Node específicas, exports CJS poco estándar, o assets
  // binarios (fonts, encodings) que el bundler no resuelve correctamente.
  //
  //   - pdfkit + fontkit: generación de PDFs (contrato post-pago,
  //     justificantes). fontkit usa exports tipo `applyDecoratedDescriptor`
  //     renombrados internamente que rompen el bundle.
  //   - pdf-parse, mammoth: extracción de texto de uploads en Factory Chat.
  //     Cargan diccionarios y workers en runtime que no se pueden bundlear.
  serverExternalPackages: ["pdfkit", "fontkit", "pdf-parse", "mammoth"],

  async headers() {
    return [
      {
        // Aplicar a todas las rutas. Next.js excluye automáticamente los
        // assets internos de `_next/static` que ya son inmutables.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
