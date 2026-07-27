import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { sendCommentNotification } from "@/lib/email";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  // 견적 접근 권한과 동일한 가드 (sales 본인 견적, 외주는 dev만)
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { createdById: true, isExternal: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }
  if (user.role === "sales" && quote.createdById !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (quote.isExternal && user.role !== "dev") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const comments = await prisma.quoteComment.findMany({
    where: { quoteId: id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true, role: true, team: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { createdBy: { select: { email: true } } },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }
  if (user.role === "sales" && quote.createdById !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (quote.isExternal && user.role !== "dev") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // 같은 작성자가 10분 내 연속 댓글을 달면 이메일 중복 발송 억제
  const recentByAuthor = await prisma.quoteComment.findFirst({
    where: {
      quoteId: id,
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  const comment = await prisma.quoteComment.create({
    data: {
      quoteId: id,
      userId: user.id,
      content: content.trim(),
    },
    include: {
      user: { select: { name: true, role: true, team: true } },
    },
  });

  if (!recentByAuthor) {
    const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/quotes/${id}`;
    await sendCommentNotification({
      quoteNumber: quote.quoteNumber,
      eventName: quote.eventName,
      quoteUrl,
      authorName: user.name,
      authorRole: user.role,
      content: comment.content,
      // 외주 견적은 외부 수신자(요청자)에게 알림을 보내지 않음
      requesterEmail: quote.isExternal ? null : quote.requesterEmail,
      createdByEmail: quote.createdBy?.email,
    }).catch((err) => console.error("[Email] 댓글 알림 실패:", err));
  }

  return NextResponse.json(comment, { status: 201 });
}
