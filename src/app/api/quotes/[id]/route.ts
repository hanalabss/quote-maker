import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

async function getAuthUser() {
  const c = await cookies();
  const raw = c.get("auth-user")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; loginId: string; name: string; role: string };
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, team: true, email: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(quote);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }

  // 상태 변경
  if (body.status) {
    // dev role만 상태 변경 가능
    const user = await getAuthUser();
    if (!user || user.role !== "dev") {
      return NextResponse.json(
        { error: "권한이 없습니다. 개발팀 관리자만 상태를 변경할 수 있습니다." },
        { status: 403 }
      );
    }

    // 상태 전이 규칙 검증
    const validTransitions: Record<string, string[]> = {
      pending: ["reviewing"],
      reviewing: ["approved", "rejected"],
      rejected: ["pending"],
    };
    const allowed = validTransitions[quote.status];
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `현재 상태(${quote.status})에서 ${body.status}(으)로 변경할 수 없습니다.` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
      reviewedById: user.id,
    };
    if (body.status === "rejected" && body.rejectionReason) {
      updateData.rejectionReason = body.rejectionReason;
    }
    if (body.reviewNote) {
      updateData.reviewNote = body.reviewNote;
    }

    const updated = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(updated);
  }

  // 항목 수정 (개발팀 검토 시)
  if (body.items) {
    // 기존 항목 삭제 후 재생성
    await prisma.quoteItem.deleteMany({ where: { quoteId: id } });

    let subtotal = 0;
    const itemsData = body.items.map(
      (
        item: { itemName: string; description?: string; unitPrice: number; quantity: number; note?: string; moduleId?: string },
        index: number
      ) => {
        const amount = item.unitPrice * item.quantity;
        subtotal += amount;
        return {
          quoteId: id,
          moduleId: item.moduleId || null,
          sortOrder: index + 1,
          itemName: item.itemName,
          description: item.description || null,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          amount,
          note: item.note || null,
        };
      }
    );

    await prisma.quoteItem.createMany({ data: itemsData });

    const vat = Math.round(subtotal * 0.1);
    const updated = await prisma.quote.update({
      where: { id },
      data: {
        subtotal,
        vat,
        totalAmount: subtotal + vat,
        reviewNote: body.reviewNote || quote.reviewNote,
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "수정할 내용이 없습니다" }, { status: 400 });
}
