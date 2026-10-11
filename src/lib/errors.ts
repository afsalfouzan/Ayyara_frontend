import { ApiError } from './api';

/** Extracts `{ field: message }` from a backend validation error. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const fieldErrors = (error.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors ?? {};
  return Object.fromEntries(Object.entries(fieldErrors).flatMap(([key, messages]) => (messages?.[0] ? [[key, messages[0]]] : [])));
}

export function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/** Random temporary password that satisfies the backend policy. */
export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${body.slice(0, 7)}-${body.slice(7)}`;
}
