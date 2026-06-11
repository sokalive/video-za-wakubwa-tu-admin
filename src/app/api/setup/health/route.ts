import { NextResponse } from "next/server";
import { getSupabaseConfig, isValidSupabaseUrl } from "@/lib/env";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db/client";

export async function GET() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  let hostname = "";
  try {
    hostname = url ? new URL(url).hostname : "";
  } catch {
    hostname = "invalid";
  }

  const status = {
    dbConfigured: isDbConfigured(),
    supabaseUrlSet: !!url,
    supabaseUrlValid: isValidSupabaseUrl(url),
    supabaseHost: hostname,
    serviceRoleKeySet: !!serviceRoleKey,
    adminCount: null as number | null,
    queryError: null as string | null,
  };

  if (!status.dbConfigured) {
    return NextResponse.json({
      success: false,
      ...status,
      hint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel from Supabase → Settings → API, then redeploy.",
    });
  }

  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("admins").select("id");
    if (error) {
      status.queryError = error.message;
    } else {
      status.adminCount = data?.length ?? 0;
    }
  } catch (err) {
    status.queryError = err instanceof Error ? err.message : "Unknown error";
  }

  return NextResponse.json({
    success: status.adminCount !== null && !status.queryError,
    ...status,
    hint:
      status.adminCount === 0
        ? "No admin found. POST /api/setup/seed-admin or run supabase/seed-admin.sql in Supabase SQL Editor."
        : undefined,
  });
}
