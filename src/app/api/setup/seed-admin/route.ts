import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db/client";

const DEFAULT_EMAIL = "waziriissa37@gmail.com";
const DEFAULT_PASSWORD = "Isamu2025";
const DEFAULT_NAME = "Waziri Admin";

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured on this deployment." },
      { status: 500 }
    );
  }

  const db = getSupabaseAdmin();
  const { data: admins, error: listError } = await db.from("admins").select("id, email");

  if (listError) {
    return NextResponse.json(
      { success: false, error: `Failed to query admins: ${listError.message}` },
      { status: 500 }
    );
  }

  const setupToken = request.headers.get("x-setup-token");
  const hasAdmins = (admins?.length ?? 0) > 0;

  if (hasAdmins && setupToken !== process.env.JWT_SECRET) {
    return NextResponse.json(
      { success: false, error: "Admin already exists. Provide x-setup-token header to reset." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || process.env.ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase();
  const password = String(body.password || process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD);
  const name = String(body.name || process.env.ADMIN_NAME || DEFAULT_NAME);

  const passwordHash = await bcrypt.hash(password, 12);
  const hashValid = await bcrypt.compare(password, passwordHash);
  if (!hashValid) {
    return NextResponse.json({ success: false, error: "bcrypt verification failed" }, { status: 500 });
  }

  const { error: upsertError } = await db.from("admins").upsert(
    { email, name, password_hash: passwordHash, role: "super_admin" },
    { onConflict: "email" }
  );

  if (upsertError) {
    return NextResponse.json(
      { success: false, error: `Failed to seed admin: ${upsertError.message}` },
      { status: 500 }
    );
  }

  const { data: created, error: verifyError } = await db
    .from("admins")
    .select("id, email, password_hash, role")
    .eq("email", email)
    .single();

  if (verifyError || !created) {
    return NextResponse.json(
      { success: false, error: verifyError?.message || "Admin not found after upsert" },
      { status: 500 }
    );
  }

  const loginWorks = await bcrypt.compare(password, created.password_hash);
  if (!loginWorks) {
    return NextResponse.json(
      { success: false, error: "Stored password hash does not match" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: hasAdmins ? "Admin password reset" : "Admin account created",
    admin: { email: created.email, role: created.role },
  });
}
