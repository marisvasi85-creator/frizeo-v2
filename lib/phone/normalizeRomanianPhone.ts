const ROMANIAN_PHONE = /^40\d{9}$/;

/**
 * Canonical MVP client identifier.
 *
 * 07..., +407..., 00407... and 407... become the same 40XXXXXXXXX value.
 * The number is intentionally not verified by OTP in this version.
 */
export function normalizeRomanianPhone(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;

  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("0040")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `40${digits.slice(1)}`;
  } else if (digits.length === 9 && digits.startsWith("7")) {
    digits = `40${digits}`;
  }

  return ROMANIAN_PHONE.test(digits) ? digits : null;
}

export function isValidRomanianPhone(value: string): boolean {
  return normalizeRomanianPhone(value) !== null;
}
