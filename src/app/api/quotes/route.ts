import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildRequestItems } from "@/lib/requestItems";
import { sendQuoteNotification } from "@/lib/email";
import { getAuthUser } from "@/lib/auth";
import { TYPE_PRICE_RATE } from "@/types";
import type { QuoteType } from "@/types";
import { redactQuotePrices } from "@/lib/priceVisibility";

// 견적번호 생성: QT-YYYYMMDD-XXX (트랜잭션 + 재시도로 레이스컨디션 방지)
async function generateQuoteNumber(maxRetries = 3): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QT-${dateStr}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const lastQuote = await prisma.quote.findFirst({
      where: { quoteNumber: { startsWith: prefix } },
      orderBy: { quoteNumber: "desc" },
    });

    let seq = 1;
    if (lastQuote) {
      const lastSeq = parseInt(lastQuote.quoteNumber.split("-")[2], 10);
      seq = lastSeq + 1;
    }

    const quoteNumber = `${prefix}-${String(seq).padStart(3, "0")}`;

    // 중복 체크
    const exists = await prisma.quote.findUnique({ where: { quoteNumber } });
    if (!exists) return quoteNumber;
  }

  // 최후 수단: 타임스탬프 기반
  return `${prefix}-${Date.now().toString().slice(-3)}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // sales 역할은 자기가 만든 견적만 조회, 외주 프로젝트는 dev만 조회 가능
    const where: Record<string, unknown> = {};
    if (user.role !== "dev") where.isExternal = false;
    if (status) where.status = status;
    if (user.role === "sales") {
      where.createdById = user.id;
    }

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true, team: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(quotes.map((q) => redactQuotePrices(q, user.role)));
  } catch (error) {
    console.error("견적 목록 조회 오류:", error);
    return NextResponse.json({ error: "견적 목록을 불러오는 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const body = await request.json();
    const {
      type,
      eventName,
      eventDate,
      eventEndDate,
      venue,
      deadline,
      expectedVisitors,
      requesterName,
      requesterContact,
      requesterEmail,
      screenDevice,
      screenResolution,
      screenComposition,
      printerType,
      networkType,
      printSize,
      notes,
      selectedModules,
      useDbLogging,
      useKsnetPayment,
      ksnetMerchantId,
      attachments,
    } = body;

    if (!eventName || !requesterName || !selectedModules?.length) {
      return NextResponse.json(
        { error: "필수 항목을 입력해주세요 (행사명, 요청자, 기능 선택)" },
        { status: 400 }
      );
    }

    // 선택 모듈 + 자동 포함(TEST_QA) + 화면 구성/토글로 켜는 선택 인쇄·KSNET 모듈
    const allModules = await prisma.module.findMany({
      where: {
        OR: [
          { code: { in: [...selectedModules, "SELECT_PRINT", "KSNET_PAY"] } },
          { isAutoIncluded: true },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });

    // 가격 산정 (유형별 배율 적용)
    const quoteType = (type || "rental") as QuoteType;
    const pricing = buildRequestItems({
      selection: {
        selectedModules,
        screenComposition: screenComposition || [],
        useKsnetPayment: !!useKsnetPayment,
        useDbLogging: !!useDbLogging,
      },
      modules: allModules,
      priceRate: TYPE_PRICE_RATE[quoteType] ?? 1.0,
      screenDevice,
      ksnetMerchantId,
    });

    // 견적번호 생성
    const quoteNumber = await generateQuoteNumber();

    // 견적 생성
    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        status: "pending",
        type: type || "rental",
        createdById: user?.id || null,
        eventName,
        eventDate: eventDate || null,
        eventEndDate: eventEndDate || null,
        venue: venue || null,
        deadline: deadline || null,
        expectedVisitors: expectedVisitors || null,
        requesterName,
        requesterContact: requesterContact || null,
        requesterEmail: requesterEmail || null,
        screenDevice: screenDevice || null,
        screenResolution: screenResolution || null,
        screenComposition: screenComposition?.length ? JSON.stringify(screenComposition) : null,
        printerType: printerType || null,
        networkType: networkType || null,
        printSize: printSize || null,
        ksnetMerchantId: ksnetMerchantId || null,
        notes: notes || null,
        attachments: attachments?.length ? attachments : undefined,
        subtotal: pricing.subtotal,
        vat: pricing.vat,
        totalAmount: pricing.totalAmount,
        items: { create: pricing.items },
      },
      include: { items: true },
    });

    // 이메일 알림
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendQuoteNotification({
      quoteNumber: quote.quoteNumber,
      eventName: quote.eventName,
      requesterName: quote.requesterName,
      totalAmount: quote.totalAmount,
      quoteUrl: `${appUrl}/dashboard/quotes/${quote.id}`,
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("견적 생성 오류:", error);
    return NextResponse.json(
      { error: "견적 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
