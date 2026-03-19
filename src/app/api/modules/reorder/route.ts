import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDev } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const authResult = await requireDev();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { orders } = await request.json();
  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: "orders 배열이 필요합니다" }, { status: 400 });
  }

  // 트랜잭션으로 일괄 업데이트
  await prisma.$transaction(
    orders.map((item: { id: string; sortOrder: number }) =>
      prisma.module.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  return NextResponse.json({ success: true });
}
