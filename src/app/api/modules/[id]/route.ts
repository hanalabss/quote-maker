import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDev } from "@/lib/auth";

// 모듈 단가/사용 여부 수정 (dev 전용)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDev();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const body = await request.json();

  const data: { basePrice?: number; isActive?: boolean } = {};

  if (body.basePrice !== undefined) {
    const price = Number(body.basePrice);
    if (!Number.isInteger(price) || price < 0) {
      return NextResponse.json({ error: "단가는 0 이상의 정수여야 합니다" }, { status: 400 });
    }
    data.basePrice = price;
  }
  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "수정할 항목이 없습니다" }, { status: 400 });
  }

  const mod = await prisma.module.update({ where: { id }, data });
  return NextResponse.json(mod);
}
