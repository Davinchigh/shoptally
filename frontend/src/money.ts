/** Money is handled as whole pesewas everywhere, and only formatted at the edge. */
export function ghs(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  const cedis = Math.floor(abs / 100).toLocaleString("en-GH");
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}GHS ${cedis}.${rest}`;
}

/** The same figure without the currency, for places where "GHS" is already said once nearby. */
export function amount(pesewas: number): string {
  return ghs(pesewas).replace("GHS ", "");
}

/** "12.5" or "12,000.50" typed by a person -> pesewas. Returns null when it is not a usable price. */
export function toPesewas(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "").replace(/^GHS/i, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const value = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return value > 0 ? value : null;
}

export type CartLine = { productId: number; quantity: number; price: number };

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}
