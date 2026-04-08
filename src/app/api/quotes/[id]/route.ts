import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, requireDev, requireAuth } from "@/lib/auth";
import { sendApprovalNotification, sendConfirmationNotification } from "@/lib/email";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, team: true, email: true } },
      reviewedBy: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, role: true, team: true } } },
      },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }

  // sales는 자기 견적만 조회 가능
  if (user.role === "sales" && quote.createdById !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  return NextResponse.json(quote);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const user = authResult.user;

  const { id } = await params;
  const body = await request.json();

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }

  // 상태 변경
  if (body.status) {
    // 사업팀 전용 전이: approved ↔ confirmed / lost
    const salesTransitions: Record<string, string[]> = {
      approved: ["confirmed", "lost"],
      confirmed: ["approved"],
      lost: ["approved"],
    };
    // 개발팀 전용 전이
    const devTransitions: Record<string, string[]> = {
      pending: ["reviewing"],
      reviewing: ["approved", "rejected"],
      approved: ["reviewing"],
      rejected: ["pending"],
    };

    const isSalesTransition = salesTransitions[quote.status]?.includes(body.status);
    const isDevTransition = devTransitions[quote.status]?.includes(body.status);

    if (isSalesTransition) {
      // 사업팀: 본인 견적만 확정/미진행 가능
      if (user.role !== "sales" && user.role !== "dev") {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
      }
      if (user.role === "sales" && quote.createdById !== user.id) {
        return NextResponse.json({ error: "본인 견적만 변경할 수 있습니다" }, { status: 403 });
      }
    } else if (isDevTransition) {
      if (user.role !== "dev") {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
      }
    } else {
      return NextResponse.json(
        { error: `현재 상태(${quote.status})에서 ${body.status}(으)로 변경할 수 없습니다.` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
    };

    // dev 상태 변경
    if (isDevTransition) {
      updateData.reviewedById = user.id;
      if (body.status === "rejected" && body.rejectionReason) {
        updateData.rejectionReason = body.rejectionReason;
      }
      if (body.reviewNote) {
        updateData.reviewNote = body.reviewNote;
      }
    }

    // 확정 처리
    if (body.status === "confirmed") {
      if (!body.devDeadline) {
        return NextResponse.json(
          { error: "개발 마감일을 입력해주세요" },
          { status: 400 }
        );
      }
      updateData.confirmedAt = new Date();
      updateData.confirmedDate = body.confirmedDate || null;
      updateData.confirmedEndDate = body.confirmedEndDate || null;
      updateData.devDeadline = body.devDeadline;
    }

    // 미진행 처리
    if (body.status === "lost") {
      updateData.lostReason = body.lostReason || null;
    }

    // 승인으로 복원 (confirmed/lost → approved)
    if (body.status === "approved" && (quote.status === "confirmed" || quote.status === "lost")) {
      updateData.confirmedAt = null;
      updateData.confirmedDate = null;
      updateData.confirmedEndDate = null;
      updateData.devDeadline = null;
      updateData.lostReason = null;
    }

    const updated = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true, team: true, email: true } },
      },
    });

    // 승인 시 → 요청자 + 개발팀에게 이메일
    if (body.status === "approved") {
      const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/quotes/${id}`;
      await sendApprovalNotification({
        quoteNumber: quote.quoteNumber,
        eventName: quote.eventName,
        requesterName: quote.requesterName,
        totalAmount: updated.totalAmount,
        quoteUrl,
        requesterEmail: quote.requesterEmail || "",
        reviewNote: updated.reviewNote,
      }).catch((err) => console.error("[Email] 승인 알림 실패:", err));
    }

    // 확정 시 → 개발팀 + 요청자에게 이메일
    if (body.status === "confirmed") {
      const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/quotes/${id}`;
      await sendConfirmationNotification({
        quoteNumber: quote.quoteNumber,
        eventName: quote.eventName,
        requesterName: quote.requesterName,
        totalAmount: quote.totalAmount,
        quoteUrl,
        confirmedDate: body.confirmedDate,
        devDeadline: body.devDeadline,
        requesterEmail: quote.requesterEmail || "",
      }).catch((err) => console.error("[Email] 확정 알림 실패:", err));
    }

    return NextResponse.json(updated);
  }

  // 항목 수정 (개발팀 검토 시)
  if (body.items) {
    if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

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
  } catch (error) {
    console.error("견적 수정 오류:", error);
    return NextResponse.json({ error: "견적 수정 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { id } = await params;
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
    }

    if (user.role === "dev") {
      // 관리자: 완전 삭제
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quote.delete({ where: { id } });
      return NextResponse.json({ deleted: true });
    }

    // 요청자 본인만 숨김 처리 가능
    if (quote.createdById !== user.id) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    await prisma.quote.update({
      where: { id },
      data: { isHidden: true },
    });
    return NextResponse.json({ hidden: true });
  } catch (error) {
    console.error("견적 삭제 오류:", error);
    return NextResponse.json({ error: "견적 삭제 중 오류가 발생했습니다" }, { status: 500 });
  }
}
