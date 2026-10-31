import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, requireDev, requireAuth } from "@/lib/auth";
import {
  sendApprovalNotification,
  sendConfirmationNotification,
  sendRevisionRequestNotification,
} from "@/lib/email";
import { applyPriceRate, formatKRW } from "@/lib/pricing";
import { TYPE_PRICE_RATE } from "@/types";
import type { QuoteType } from "@/types";
import { buildBaselineMap, normalizeItemName } from "@/lib/baseline";
import { buildRequestItems, SCREEN_FLOWS } from "@/lib/requestItems";

// 승인 가드레일: 단가·납기 자동 검증. 경고 목록 반환 (soft gate — overrideReason으로 강행 가능)
async function collectApprovalWarnings(quote: {
  id: string;
  type: string;
  deadline: string | null;
}): Promise<string[]> {
  const warnings: string[] = [];

  const [items, modules, refItems] = await Promise.all([
    prisma.quoteItem.findMany({ where: { quoteId: quote.id } }),
    prisma.module.findMany({ select: { id: true, basePrice: true } }),
    prisma.referenceQuoteItem.findMany({
      where: { refQuote: { isException: false }, unitPrice: { gt: 0 } },
      select: { itemName: true, unitPrice: true },
    }),
  ]);

  const baseline = buildBaselineMap(refItems);
  const rate = TYPE_PRICE_RATE[quote.type as QuoteType] ?? 1;
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  for (const item of items) {
    // 1) 모듈 기준가 대비 ±20% 검증 (유형 배율 적용)
    const mod = item.moduleId ? moduleById.get(item.moduleId) : undefined;
    if (mod && mod.basePrice > 0) {
      const expected = applyPriceRate(mod.basePrice, rate);
      if (expected > 0 && Math.abs(item.unitPrice - expected) / expected > 0.2) {
        warnings.push(
          `"${item.itemName}" 단가 ${formatKRW(item.unitPrice)}원 — 모듈 기준가 ${formatKRW(expected)}원(유형 배율 적용) 대비 ±20% 초과`
        );
      }
    }
    // 2) 참고 견적 시세 하한(p25) 검증 — 표본 3개 이상 & 판매 유형만
    //    (참고 견적은 SI 판매 건이라 렌탈/재행사 단가와 스케일이 달라 오탐 발생)
    if (quote.type === "sale") {
      const stat = baseline[normalizeItemName(item.itemName)];
      if (stat && stat.n >= 3 && item.unitPrice < stat.p25) {
        warnings.push(
          `"${item.itemName}" 단가 ${formatKRW(item.unitPrice)}원 — 참고 견적 시세 하한 p25 ${formatKRW(stat.p25)}원(n=${stat.n}) 미만`
        );
      }
    }
  }

  // 3) 납기일 경과 검증
  if (quote.deadline) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (quote.deadline < todayStr) {
      warnings.push(`요청 납기일(${quote.deadline})이 이미 지났습니다 — 일정 재확인 필요`);
    }
  }

  return warnings;
}

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

  // 외주 프로젝트는 dev만 조회 가능
  if (quote.isExternal && user.role !== "dev") {
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

  // 외주 프로젝트는 dev만 수정 가능
  if (quote.isExternal && user.role !== "dev") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // 상태 변경
  if (body.status) {
    // 사업팀 전용 전이: approved ↔ confirmed / lost / completed + 수정 요청(approved → reviewing)
    // 보류(on_hold): 승인 후 장기 대기 — 미진행과 달리 언제든 재개/확정 가능
    const salesTransitions: Record<string, string[]> = {
      approved: ["confirmed", "lost", "reviewing", "on_hold"],
      on_hold: ["approved", "confirmed", "lost", "on_hold"], // on_hold→on_hold = 보류 사유 갱신
      confirmed: ["approved", "completed"],
      completed: ["confirmed"],
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

    // 승인 가드레일 (soft gate): reviewing → approved 시 단가/납기 자동 검증
    if (body.status === "approved" && quote.status === "reviewing" && !body.overrideReason) {
      const warnings = await collectApprovalWarnings(quote);
      if (warnings.length > 0) {
        return NextResponse.json(
          { error: "승인 전 확인이 필요한 항목이 있습니다", warnings },
          { status: 422 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
    };

    // dev 상태 변경 (사업팀의 수정 요청 approved→reviewing은 검토자 변경 없음)
    if (isDevTransition && user.role === "dev") {
      updateData.reviewedById = user.id;
      if (body.status === "rejected" && body.rejectionReason) {
        updateData.rejectionReason = body.rejectionReason;
      }
      if (body.reviewNote) {
        updateData.reviewNote = body.reviewNote;
      }
    }

    // 사업팀 수정 요청: approved → reviewing 사유 기록
    const isRevisionRequest =
      body.status === "reviewing" && quote.status === "approved" && !!body.revisionReason;
    if (isRevisionRequest) {
      updateData.revisionReason = String(body.revisionReason);
    }

    // 승인 시: 가드레일 무시 사유를 검토 메모에 기록 + 수정 요청 사유 해소
    if (body.status === "approved") {
      updateData.revisionReason = null;
      if (body.overrideReason) {
        const base = (body.reviewNote as string) || quote.reviewNote || "";
        updateData.reviewNote = `${base ? base + "\n" : ""}[가드레일 무시] ${body.overrideReason}`;
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

    // 보류 처리 / 해제
    if (body.status === "on_hold") {
      updateData.holdReason = body.holdReason || null;
    } else if (quote.status === "on_hold") {
      updateData.holdReason = null;
    }

    // 승인으로 복원 (confirmed/lost → approved)
    if (body.status === "approved" && (quote.status === "confirmed" || quote.status === "lost")) {
      updateData.confirmedAt = null;
      updateData.confirmedDate = null;
      updateData.confirmedEndDate = null;
      updateData.devDeadline = null;
      updateData.devCompletedAt = null;
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
    // 실제 승인 이벤트(reviewing→approved)에만 발송 — 보류 재개/미진행·확정 복원은 재발송 안 함
    if (body.status === "approved" && quote.status === "reviewing") {
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

    // 수정 요청 시 → 개발팀에게 이메일
    if (isRevisionRequest) {
      const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/quotes/${id}`;
      await sendRevisionRequestNotification({
        quoteNumber: quote.quoteNumber,
        eventName: quote.eventName,
        requesterName: quote.requesterName,
        reason: String(body.revisionReason),
        quoteUrl,
      }).catch((err) => console.error("[Email] 수정 요청 알림 실패:", err));
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

  // 개발 완료(배포) 토글 — 확정 상태에서 dev만 (상태 enum 변경 없이 생애주기 단계만 기록)
  if (typeof body.devCompleted === "boolean") {
    if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    if (quote.status !== "confirmed") {
      return NextResponse.json(
        { error: "확정 상태의 견적만 개발 완료 처리할 수 있습니다" },
        { status: 400 }
      );
    }
    const updated = await prisma.quote.update({
      where: { id },
      data: { devCompletedAt: body.devCompleted ? new Date() : null },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true, team: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // 입금 기록 (계약금/잔금 입금일 — dev 전용)
  if (body.payment && typeof body.payment === "object") {
    if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const paymentData: Record<string, string | null> = {};
    for (const key of ["depositPaidAt", "balancePaidAt"] as const) {
      if (key in body.payment) {
        const v = body.payment[key];
        paymentData[key] = v === "" || v === null ? null : String(v);
      }
    }
    if (Object.keys(paymentData).length === 0) {
      return NextResponse.json({ error: "수정할 내용이 없습니다" }, { status: 400 });
    }
    const updated = await prisma.quote.update({
      where: { id },
      data: paymentData,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true, team: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // 기능 수정 (기능 선택·화면 구성 → 항목·금액 재산정) — 대기중(pending)일 때만, 요청자 본인 또는 dev
  // 개발팀 검토가 시작되면(reviewing~) 손본 항목이 덮어써지지 않게 막고, 댓글·수정 요청으로 받는다.
  if (body.requestEdit && typeof body.requestEdit === "object") {
    if (quote.status !== "pending") {
      return NextResponse.json(
        { error: "대기중인 견적만 기능을 수정할 수 있습니다. 검토가 시작된 견적은 댓글로 요청해주세요." },
        { status: 400 }
      );
    }
    if (user.role === "sales") {
      if (quote.createdById !== user.id) {
        return NextResponse.json({ error: "본인 견적만 수정할 수 있습니다" }, { status: 403 });
      }
    } else if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const re = body.requestEdit;
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === "string");
    if (!isStringArray(re.selectedModules) || re.selectedModules.length === 0) {
      return NextResponse.json({ error: "기능을 하나 이상 선택해주세요" }, { status: 400 });
    }
    if (re.screenComposition !== undefined && !isStringArray(re.screenComposition)) {
      return NextResponse.json({ error: "화면 구성 형식이 올바르지 않습니다" }, { status: 400 });
    }
    const selection = {
      selectedModules: [...new Set(re.selectedModules as string[])],
      screenComposition: [...new Set((re.screenComposition as string[] | undefined) ?? [])],
      useKsnetPayment: !!re.useKsnetPayment,
      useDbLogging: !!re.useDbLogging,
    };

    const allModules = await prisma.module.findMany({
      where: {
        OR: [
          { code: { in: [...selection.selectedModules, "SELECT_PRINT", "KSNET_PAY"] } },
          { isAutoIncluded: true },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });
    // 요청 폼과 같은 범위: 활성 + 외주 전용 제외
    const unknown = selection.selectedModules.filter(
      (code) => !allModules.some((m) => m.code === code && m.isActive && m.category !== "external")
    );
    if (unknown.length > 0) {
      return NextResponse.json({ error: `선택할 수 없는 기능입니다: ${unknown.join(", ")}` }, { status: 400 });
    }

    const pricing = buildRequestItems({
      selection,
      modules: allModules,
      priceRate: TYPE_PRICE_RATE[quote.type as QuoteType] ?? 1.0,
      screenDevice: quote.screenDevice,
      ksnetMerchantId: quote.ksnetMerchantId,
    });

    const before = await prisma.quoteItem.findMany({
      where: { quoteId: id },
      orderBy: { sortOrder: "asc" },
      select: { itemName: true },
    });
    const beforeNames = before.map((it) => it.itemName);
    const afterNames = pricing.items.map((it) => it.itemName);
    const added = afterNames.filter((n) => !beforeNames.includes(n));
    const removed = beforeNames.filter((n) => !afterNames.includes(n));
    const flowLabel = (v: string) => SCREEN_FLOWS.find((f) => f.value === v)?.label ?? v;
    let prevFlow: string[] = [];
    try {
      prevFlow = quote.screenComposition ? JSON.parse(quote.screenComposition) : [];
    } catch {
      prevFlow = [];
    }
    const flowChanged = prevFlow.join(",") !== selection.screenComposition.join(",");

    // 금액은 dev_staff에게 비노출이라 이력 댓글에는 항목명만 남긴다
    const lines = ["[기능 수정] 요청자가 기능 선택을 수정했습니다."];
    if (added.length) lines.push(`- 추가: ${added.join(", ")}`);
    if (removed.length) lines.push(`- 제외: ${removed.join(", ")}`);
    if (flowChanged) {
      lines.push(
        `- 화면 구성: ${prevFlow.map(flowLabel).join(" → ") || "없음"} → ${selection.screenComposition.map(flowLabel).join(" → ") || "없음"}`
      );
    }
    if (lines.length === 1) lines.push("- 변경 없음 (재산정만)");

    try {
      await prisma.$transaction(async (tx) => {
        // 동시에 검토가 시작됐으면 덮어쓰지 않는다
        const r = await tx.quote.updateMany({
          where: { id, status: "pending" },
          data: {
            screenComposition: selection.screenComposition.length ? JSON.stringify(selection.screenComposition) : null,
            subtotal: pricing.subtotal,
            vat: pricing.vat,
            totalAmount: pricing.totalAmount,
          },
        });
        if (r.count === 0) throw new Error("NOT_PENDING");
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quoteItem.createMany({ data: pricing.items.map((it) => ({ ...it, quoteId: id })) });
        await tx.quoteComment.create({ data: { quoteId: id, userId: user.id, content: lines.join("\n") } });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_PENDING") {
        return NextResponse.json(
          { error: "방금 검토가 시작되어 수정할 수 없습니다. 댓글로 요청해주세요." },
          { status: 409 }
        );
      }
      throw e;
    }

    const updated = await prisma.quote.findUnique({
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
    return NextResponse.json(updated);
  }

  // 기본정보 수정 (가격 무관 필드 — 사업팀 본인 견적 또는 dev)
  // 보류(on_hold)도 허용: 보류 사유가 대개 일정 변경이라 행사일/납기 갱신이 필요
  if (body.basicInfo && typeof body.basicInfo === "object") {
    const editableStates = ["pending", "reviewing", "approved", "on_hold"];
    if (!editableStates.includes(quote.status)) {
      return NextResponse.json(
        { error: "확정/완료된 견적은 기본정보를 수정할 수 없습니다" },
        { status: 400 }
      );
    }
    if (user.role === "sales") {
      if (quote.createdById !== user.id) {
        return NextResponse.json({ error: "본인 견적만 수정할 수 있습니다" }, { status: 403 });
      }
    } else if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 가격에 영향 없는 필드만 화이트리스트 (모듈/화면구성 변경은 수정 요청 플로우 사용)
    const allowedFields = [
      "eventDate",
      "eventEndDate",
      "venue",
      "deadline",
      "expectedVisitors",
      "requesterContact",
      "requesterEmail",
      "notes",
    ] as const;
    const basicData: Record<string, string | null> = {};
    for (const key of allowedFields) {
      if (key in body.basicInfo) {
        const v = body.basicInfo[key];
        basicData[key] = v === "" || v === null ? null : String(v);
      }
    }
    if (Object.keys(basicData).length === 0) {
      return NextResponse.json({ error: "수정할 내용이 없습니다" }, { status: 400 });
    }

    const updated = await prisma.quote.update({
      where: { id },
      data: basicData,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true, team: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // 항목 수정 (개발팀 검토 시)
  if (body.items) {
    if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    // 확정/완료된 견적은 매출 인식이 끝났으므로 항목(금액) 무흔적 수정 금지 (basicInfo와 동일 기준)
    if (!["pending", "reviewing", "approved", "on_hold"].includes(quote.status)) {
      return NextResponse.json(
        { error: "확정/완료된 견적은 항목을 수정할 수 없습니다" },
        { status: 400 }
      );
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
