import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDev } from "@/lib/auth";
import { buildBaselineMap } from "@/lib/baseline";

// 참고 견적(ReferenceQuote) 기반 항목별 단가 baseline (dev 전용)
export async function GET() {
  const authResult = await requireDev();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const items = await prisma.referenceQuoteItem.findMany({
    where: { refQuote: { isException: false }, unitPrice: { gt: 0 } },
    select: { itemName: true, unitPrice: true },
  });

  const stats = buildBaselineMap(items);

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), sampleCount: items.length, stats },
    { headers: { "Cache-Control": "no-store" } }
  );
}
