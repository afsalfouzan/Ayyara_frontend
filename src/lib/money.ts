const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const withPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Money is integer paise everywhere; format only at the edge. Whole rupees show no decimals; anything else shows both paise digits (₹2,750.50, never ₹2,750.5). */
export function formatPaise(paise: number | null | undefined) {
  if (paise == null) return '—';
  return (paise % 100 === 0 ? whole : withPaise).format(paise / 100);
}

/** "4,500.50" → 450050. Returns null for empty input and NaN for invalid input. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function paiseToInput(paise: number | null | undefined) {
  if (paise == null) return '';
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
