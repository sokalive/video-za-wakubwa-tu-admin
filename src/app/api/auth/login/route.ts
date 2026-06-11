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

    const admin = validateCredentials(email, password);

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
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
