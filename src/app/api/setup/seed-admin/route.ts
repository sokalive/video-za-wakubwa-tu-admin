import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import { supabaseRest } from "@/lib/db/rest";

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

  const { data: admins, error: listError } = await supabaseRest<{ id: string; email: string }[]>(
    "admins?select=id,email"
  );

  if (listError) {
    return NextResponse.json(
      { success: false, error: `Failed to query admins: ${listError}` },
      { status: 500 }
    );
  }

  const setupToken = request.headers.get("x-setup-token");
  const hasAdmins = (admins?.length ?? 0) > 0;

  if (hasAdmins && setupToken !== sanitizeEnv(process.env.JWT_SECRET)) {
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

  const { data: created, error: upsertError, status } = await supabaseRest<
    { id: string; email: string; role: string; password_hash: string }[]
  >("admins?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      email,
      name,
      password_hash: passwordHash,
      role: "super_admin",
    }),
  });

  if (upsertError) {
    return NextResponse.json(
      { success: false, error: `Failed to seed admin (HTTP ${status}): ${upsertError}` },
      { status: 500 }
    );
  }

  const row = created?.[0];
  if (!row) {
    return NextResponse.json({ success: false, error: "Admin not returned after upsert" }, { status: 500 });
  }

  const loginWorks = await bcrypt.compare(password, row.password_hash);
  if (!loginWorks) {
    return NextResponse.json(
      { success: false, error: "Stored password hash does not match" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: hasAdmins ? "Admin password reset" : "Admin account created",
    admin: { email: row.email, role: row.role },
  });
}
