import { getSupabaseConfig, isValidSupabaseUrl } from "@/lib/env";

export async function supabaseRest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey || !isValidSupabaseUrl(url)) {
    return { data: null, error: "Supabase not configured", status: 500 };
  }

  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return { data: null, error: text.slice(0, 300), status: res.status };
  }

  if (!text) return { data: null, error: null, status: res.status };
  return { data: JSON.parse(text) as T, error: null, status: res.status };
}
