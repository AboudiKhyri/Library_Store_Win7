/**
 * LIBRARY_STORE — Barcode Generation & Validation Utilities
 * EAN-13 standard with in-store prefix (200-299) and GS1 check digit.
 * Zero external dependencies. Fully offline compatible.
 */

'use strict';

/**
 * Calculates the standard GS1 check digit for a 12-digit numeric string.
 * Weights: 1 for odd positions (index 0, 2, 4...), 3 for even positions (index 1, 3, 5...).
 * Check digit = (10 - (sum % 10)) % 10.
 */
export function calculateEan13CheckDigit(payload12: string): number {
  if (typeof payload12 !== 'string' || payload12.length !== 12 || !/^\d{12}$/.test(payload12)) {
    throw new Error('EAN-13 payload must be exactly 12 numeric digits');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = payload12.charCodeAt(i) - 48; // ASCII '0' = 48
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates whether a 13-digit string is a mathematically valid EAN-13 barcode.
 */
export function isValidEan13(barcode: string): boolean {
  if (typeof barcode !== 'string' || barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
    return false;
  }
  const payload12 = barcode.slice(0, 12);
  const expectedCheckDigit = calculateEan13CheckDigit(payload12);
  const actualCheckDigit = barcode.charCodeAt(12) - 48;
  return expectedCheckDigit === actualCheckDigit;
}

/**
 * Generates cryptographically random numeric digits string of specified length.
 * Compatible with browser (crypto.getRandomValues) and Node.js (crypto.randomBytes).
 */
export function getRandomDigits(length: number): string {
  if (length <= 0) return '';

  let bytes: Uint8Array;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
  } else {
    // Node.js environment
    const crypto = require('crypto');
    bytes = new Uint8Array(crypto.randomBytes(length));
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += (bytes[i] % 10).toString();
  }
  return result;
}

/**
 * Generates a valid EAN-13 barcode with an in-store restricted distribution prefix (200-299).
 * Standard GS1 allows prefixes 200 through 299 for internal store use without collision with global products.
 *
 * @param prefix Optional 3-digit in-store prefix between 200 and 299. Defaults to 200.
 */
export function generateEan13(prefix = 200): string {
  if (prefix < 200 || prefix > 299) {
    throw new Error('In-store EAN-13 prefix must be between 200 and 299');
  }

  const prefixStr = String(prefix).padStart(3, '0');
  // Need 9 random digits to complete 12 payload digits (3 + 9 = 12)
  const randomBody = getRandomDigits(9);
  const payload12 = prefixStr + randomBody;
  const checkDigit = calculateEan13CheckDigit(payload12);

  return payload12 + checkDigit.toString();
}

/**
 * Generates a unique in-store EAN-13 barcode that does not exist in the provided set of existing barcodes.
 * Retries up to maxRetries times to prevent collisions.
 */
export function generateUniqueBarcode(
  existingBarcodes: Set<string> | string[],
  prefix = 200,
  maxRetries = 10
): string {
  const set = existingBarcodes instanceof Set ? existingBarcodes : new Set(existingBarcodes);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateEan13(prefix);
    if (!set.has(candidate)) {
      return candidate;
    }
  }

  // Fallback: try adjacent in-store prefix
  for (let altPrefix = 201; altPrefix <= 299; altPrefix++) {
    const candidate = generateEan13(altPrefix);
    if (!set.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Failed to generate a unique barcode after maximum attempts');
}

/**
 * Normalizes a barcode string:
 * - Trims leading and trailing whitespace
 * - Strips non-printable ASCII control characters
 * - Preserves leading zeros
 * - Converts empty or whitespace-only strings to null
 */
export function normalizeBarcode(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const str = String(input).replace(/[\x00-\x1F\x7F]/g, '').trim();
  return str.length > 0 ? str : null;
}
