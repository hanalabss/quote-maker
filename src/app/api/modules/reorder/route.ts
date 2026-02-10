import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  // dev 권한 체크
  const cookieStore = await cookies();
  const raw = cookieStore.get("auth-user")?.value;
  if (!raw) {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  try {
    const user = JSON.parse(raw);
    if (user.role !== "dev") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "인증 오류" }, { status: 401 });
  }

  const { orders } = await request.json();
  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: "orders 배열이 필요합니다" }, { status: 400 });
  }

  // 각 모듈의 sortOrder 일괄 업데이트
  await Promise.all(
    orders.map((item: { id: string; sortOrder: number }) =>
      prisma.module.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  return NextResponse.json({ success: true });
}
