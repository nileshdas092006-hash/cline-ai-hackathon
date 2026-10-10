// Aadhaar masking: only the last 4 digits are ever shown. Pure.

/** "1234 5678 9012" → "XXXX XXXX 9012". Fewer than 4 digits → no digits at all. */
export function maskAadhaar(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 4) return "XXXX XXXX XXXX";
  return `XXXX XXXX ${digits.slice(-4)}`;
}
