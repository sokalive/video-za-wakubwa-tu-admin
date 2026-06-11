/** Trim quotes, whitespace, trailing slashes, and common mistaken path suffixes. */
export function sanitizeEnv(value: string | undefined): string {
  if (!value) return "";
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/\/+$/, "");
  v = v.replace(/\/rest\/v1$/i, "");
  v = v.replace(/\/storage\/v1$/i, "");
  return v.replace(/\/+$/, "");
}

export function sanitizeSupabaseKey(value: string | undefined): string {
  let v = sanitizeEnv(value);
  if (v.toLowerCase().startsWith("bearer ")) {
    v = v.slice(7).trim();
  }
  return v.replace(/\s+/g, "");
}

export function getSupabaseConfig() {
  const url = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { url, serviceRoleKey };
}

export function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".supabase.co") &&
      path === "/"
    );
  } catch {
    return false;
  }
}
