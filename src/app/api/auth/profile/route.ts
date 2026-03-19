import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

// 프로필 조회 (DB에서 최신 정보)
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      loginId: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      team: true,
      position: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// 프로필 수정
export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, phone, team, position, password } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "이름은 필수입니다" }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "이메일은 필수입니다" }, { status: 400 });
    }

    const updateData: Record<string, string | null> = {
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      team: team?.trim() || null,
      position: position?.trim() || null,
    };

    // 비밀번호 변경 (입력한 경우만) - bcrypt 해싱
    if (password?.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 12);
    }

    const updated = await prisma.user.update({
      where: { id: authUser.id },
      data: updateData,
      select: {
        id: true,
        loginId: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        team: true,
        position: true,
      },
    });

    // 쿠키도 갱신
    const cookieStore = await cookies();
    cookieStore.set("auth-user", JSON.stringify({
      id: updated.id,
      loginId: updated.loginId,
      name: updated.name,
      role: updated.role,
      team: updated.team,
      position: updated.position,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("프로필 수정 오류:", error);
    return NextResponse.json({ error: "프로필 수정 중 오류가 발생했습니다" }, { status: 500 });
  }
}
