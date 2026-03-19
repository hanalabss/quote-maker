import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

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

    if (!user) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다" },
        { status: 401 }
      );
    }

    // bcrypt 해시와 비교. 마이그레이션 기간 동안 평문도 허용 후 자동 해싱.
    let passwordValid = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      // 평문 비밀번호 → 일치하면 자동으로 해시 업데이트
      passwordValid = user.password === password;
      if (passwordValid) {
        const hashed = await bcrypt.hash(password, 12);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        });
      }
    }

    if (!passwordValid) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다" },
        { status: 401 }
      );
    }

    // 쿠키에 최소한의 식별 정보만 저장 (role은 DB에서 검증)
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
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
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
