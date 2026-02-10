import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { loginId, password } = await request.json();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { loginId },
    });

    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다" },
        { status: 401 }
      );
    }

    // 쿠키에 사용자 정보 저장
    const cookieStore = await cookies();
    cookieStore.set("auth-user", JSON.stringify({
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      team: user.team,
      position: user.position,
    }), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7일
      sameSite: "lax",
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      team: user.team,
      position: user.position,
    });
  } catch (error) {
    console.error("로그인 오류:", error);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
