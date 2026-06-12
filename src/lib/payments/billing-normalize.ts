export function maskSecret(s: string | null | undefined): string {
  if (!s || String(s).length < 8) return "";
  const v = String(s);
  return `${v.slice(0, 4)}${"•".repeat(Math.min(16, v.length - 8))}${v.slice(-4)}`;
}

export function normalizePhoneDigits(phone: string): string {
  const digits = String(phone ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (/^0\d{9}$/.test(digits)) return `255${digits.slice(1)}`;
  if (/^[67]\d{8}$/.test(digits)) return `255${digits}`;
  if (/^255\d{9}$/.test(digits)) return digits;
  return digits;
}

export function formatPhoneE164(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
}
