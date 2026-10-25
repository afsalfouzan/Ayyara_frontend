/*
 * The WhatsApp number on a UK sale. Staff pick the country (UK or India) and
 * type the number the usual way, e.g. 07700 900123; it is saved with its
 * country code (+447700900123) so WhatsApp opens the right chat.
 */

export const COUNTRY_CODES = [
  { code: '+44', label: 'UK +44' },
  { code: '+91', label: 'India +91' },
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number]['code'];
export type WhatsAppNumber = { code: CountryCode; number: string };

export const emptyWhatsAppNumber = (): WhatsAppNumber => ({ code: '+44', number: '' });

/** Splits a saved number back into the picker and the box. An older number without a country code is left in the box as typed. */
export function splitWhatsAppNumber(saved: string): WhatsAppNumber {
  const match = COUNTRY_CODES.find((c) => saved.startsWith(c.code));
  return match ? { code: match.code, number: saved.slice(match.code.length) } : { code: '+44', number: saved };
}

/**
 * The number as it is saved, or '' when the box is empty. A number typed with
 * its own + code is kept as it is; otherwise the leading 0 is dropped and the
 * picked country code added.
 */
export function joinWhatsAppNumber({ code, number }: WhatsAppNumber) {
  const typed = number.replace(/[\s().-]/g, '');
  if (!typed) return '';
  if (typed.startsWith('+')) return typed;
  return `${code}${typed.replace(/^0+/, '')}`;
}

/** An error message, or null when the number is fine or empty. */
export function whatsAppNumberError(value: WhatsAppNumber) {
  const full = joinWhatsAppNumber(value);
  if (!full) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(full)) return 'Enter a valid WhatsApp number';
  if (full.startsWith('+44') && !/^\+447\d{9}$/.test(full)) return 'Enter a UK mobile number, e.g. 07700 900123';
  if (full.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(full)) return 'Enter a 10-digit Indian mobile number';
  return null;
}
