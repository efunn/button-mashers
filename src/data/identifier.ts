/** Crockford base32 (no I/L/O/U): unambiguous when read aloud or written. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomIdentifier(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}
