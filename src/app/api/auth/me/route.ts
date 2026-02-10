import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-user");

  if (!authCookie) {
    return NextResponse.json(null, { status: 401 });
  }

  try {
    const user = JSON.parse(authCookie.value);
    return NextResponse.json(user);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
