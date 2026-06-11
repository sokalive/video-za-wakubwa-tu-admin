import { NextResponse } from "next/server";
import { createSession, setSessionCookie, validateCredentials } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const admin = await validateCredentials(email, password);

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSession(admin);
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      admin: { name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
