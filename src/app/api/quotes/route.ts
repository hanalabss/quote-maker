import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { calculateQuote } from "@/lib/pricing";
import { sendQuoteNotification } from "@/lib/email";
import { TYPE_PRICE_RATE } from "@/types";
import type { QuoteType } from "@/types";

function getAuthUser() {
  // Note: cookies() is async in Next.js 14+ but we call it at request time
  return cookies().then((c) => {
    const raw = c.get("auth-user")?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { id: string; loginId: string; name: string; role: string };
    } catch {
      return null;
    }
  });
}

// 견적번호 생성: QT-YYYYMMDD-XXX
async function generateQuoteNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QT-${dateStr}`;

  const lastQuote = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: "desc" },
  });

  let seq = 1;
  if (lastQuote) {
    const lastSeq = parseInt(lastQuote.quoteNumber.split("-")[2], 10);
    seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const user = await getAuthUser();

  // sales 역할은 자기가 만든 견적만 조회
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (user && user.role === "sales") {
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

  return NextResponse.json(quotes);
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

    // 선택된 모듈 조회
    const modules = await prisma.module.findMany({
      where: { code: { in: selectedModules } },
      orderBy: { sortOrder: "asc" },
    });

    // 자동 포함 모듈 추가 (TEST_QA)
    const autoModules = await prisma.module.findMany({
      where: { isAutoIncluded: true, code: { notIn: selectedModules } },
    });

    const allModules = [...modules, ...autoModules];

    // 화면 구성 라벨 매핑
    const screenLabels: Record<string, string> = {
      splash: "스플래시",
      camera: "카메라 촬영",
      qr: "QR 업로드",
      image_select: "이미지 선택",
      select_print: "선택 인쇄",
      text_input: "텍스트 입력",
      printing: "인쇄 진행 중",
      complete: "인쇄 완료",
    };

    // 가격 산정 (유형별 배율 적용)
    const quoteType = (type || "rental") as QuoteType;
    const priceRate = TYPE_PRICE_RATE[quoteType] ?? 1.0;
    const pricing = calculateQuote(allModules, priceRate);

    // UI_BASIC 항목에 화면 구성 설명 적용
    if (screenComposition?.length > 0) {
      const flowDesc = (screenComposition as string[])
        .map((v: string) => screenLabels[v] || v)
        .join(" → ");
      const uiItem = pricing.items.find((item) => item.moduleCode === "UI_BASIC");
      if (uiItem) {
        uiItem.description = flowDesc;
      }
    }

    // 선택 인쇄 항목 추가 (화면 구성에 select_print 포함 시)
    if ((screenComposition as string[])?.includes("select_print")) {
      const selectPrintPrice = Math.round(150000 * priceRate);
      pricing.items.push({
        moduleCode: "SELECT_PRINT",
        moduleName: "선택 인쇄 기능",
        description: "업로드 이미지 선택 출력",
        unitPrice: selectPrintPrice,
        quantity: 1,
        amount: selectPrintPrice,
      });
      pricing.subtotal += selectPrintPrice;
      pricing.vat = Math.round(pricing.subtotal * 0.1);
      pricing.totalAmount = pricing.subtotal + pricing.vat;
    }

    // KSNET 결제 연동 항목 추가
    if (useKsnetPayment) {
      const ksnetPrice = Math.round(300000 * priceRate);
      pricing.items.push({
        moduleCode: "KSNET_PAY",
        moduleName: "KSNET 결제 시스템 연동",
        description: "KSNET 실결제 연동, 카드 결제 테스트 및 검증, 실결제 환경 적용",
        unitPrice: ksnetPrice,
        quantity: 1,
        amount: ksnetPrice,
      });
      pricing.subtotal += ksnetPrice;
      pricing.vat = Math.round(pricing.subtotal * 0.1);
      pricing.totalAmount = pricing.subtotal + pricing.vat;
    }

    // DB 로그 서비스 항목 추가 (무료)
    if (useDbLogging) {
      pricing.items.push({
        moduleCode: "DB_LOG",
        moduleName: "DB 직접 연결 로그",
        description: "인쇄 횟수/사용 통계 기록 (서비스)",
        unitPrice: 0,
        quantity: 1,
        amount: 0,
      });
    }

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
        items: {
          create: pricing.items.map((item, index) => ({
            moduleId: allModules.find((m) => m.code === item.moduleCode)?.id || null,
            sortOrder: index + 1,
            itemName: item.moduleName,
            description: item.description,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            amount: item.amount,
            note: item.moduleCode === "DB_LOG" ? "서비스"
              : item.moduleCode === "KSNET_PAY" && ksnetMerchantId ? `가맹점: ${ksnetMerchantId}`
              : undefined,
          })),
        },
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
