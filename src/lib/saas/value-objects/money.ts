/**
 * Money · value object.
 *
 * Representa un importe en céntimos enteros (NUNCA flotante) + moneda.
 * Todo el código de Prontara que mueve dinero (Stripe, facturas,
 * límites de plan, contrato) debería usar este tipo.
 *
 * Por qué céntimos enteros y no float:
 *   - Floats arrastran errores de precisión (0.1 + 0.2 !== 0.3).
 *   - Stripe trabaja en céntimos enteros — alinearse evita conversiones.
 *   - La aritmética con enteros es exacta y predecible.
 *
 * Por qué guardamos la moneda:
 *   - Aunque hoy Prontara solo factura en EUR, el día que se contrate
 *     un cliente fuera de la UE no queremos repetir el bug clásico de
 *     mezclar EUR con USD.
 */
export type CurrencyCode = "EUR" | "USD" | "GBP";

declare const MoneyBrand: unique symbol;
export type Money = {
  readonly cents: number;
  readonly currency: CurrencyCode;
  readonly [MoneyBrand]: true;
};

const KNOWN_CURRENCIES: ReadonlyArray<CurrencyCode> = ["EUR", "USD", "GBP"];

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (KNOWN_CURRENCIES as ReadonlyArray<string>).includes(value);
}

export function money(cents: number, currency: CurrencyCode = "EUR"): Money {
  if (!Number.isInteger(cents)) {
    throw new Error("Money requiere céntimos enteros (recibido: " + cents + ").");
  }
  if (cents < 0) {
    throw new Error("Money no puede ser negativo (usar refund/credit en otro tipo).");
  }
  if (!isCurrency(currency)) {
    throw new Error("Money: moneda desconocida " + currency);
  }
  return Object.freeze({ cents, currency }) as Money;
}

export function parseMoney(input: { cents: unknown; currency?: unknown }): Money | null {
  const cents = typeof input.cents === "number" ? input.cents : Number(input.cents);
  if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents < 0) return null;
  const currency = input.currency ?? "EUR";
  if (!isCurrency(currency)) return null;
  return money(cents, currency);
}

/**
 * Suma dos importes. Lanza si las monedas no coinciden — esto es
 * deliberado: mezclar monedas es bug, no caso normal.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      "No se pueden sumar importes en monedas distintas: " + a.currency + " vs " + b.currency,
    );
  }
  return money(a.cents + b.cents, a.currency);
}

/**
 * Multiplica un importe por un escalar (típicamente un número de
 * usuarios, una cantidad de meses, etc). El escalar debe ser entero
 * positivo — para descuentos porcentuales se usa otra función futura.
 */
export function multiplyMoney(a: Money, multiplier: number): Money {
  if (!Number.isInteger(multiplier) || multiplier < 0) {
    throw new Error("multiplyMoney requiere un entero positivo.");
  }
  return money(a.cents * multiplier, a.currency);
}

const FORMAT_LOCALE: Record<CurrencyCode, string> = {
  EUR: "es-ES",
  USD: "en-US",
  GBP: "en-GB",
};

/**
 * Formatea para mostrar al usuario. Devuelve "1.250,00 €" para EUR,
 * "$12.50" para USD, etc.
 */
export function formatMoney(value: Money): string {
  const formatter = new Intl.NumberFormat(FORMAT_LOCALE[value.currency], {
    style: "currency",
    currency: value.currency,
  });
  return formatter.format(value.cents / 100);
}
