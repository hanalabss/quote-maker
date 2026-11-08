import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { sendCommentNotification } from "@/lib/email";
import { canAccessQuote, canSeeChannel, commentsInclude, type CommentChannel } from "@/lib/quoteAccess";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  // 견적 접근 권한과 동일한 가드 (sales 본인 견적, dev_staff 담당 견적, 외주는 dev만)
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { createdById: true, isExternal: true, devAssigneeId: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }
  if (!canAccessQuote(user, quote)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // dev_staff에게는 개발 채널만
  const comments = await prisma.quoteComment.findMany({
    where: { quoteId: id, ...commentsInclude(user.role).where },
    orderBy: { createdAt: "asc" },
    include: commentsInclude(user.role).include,
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
  const { content, visibility, parentId } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      createdBy: { select: { email: true } },
      devAssignee: { select: { email: true } },
    },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }
  if (!canAccessQuote(user, quote)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // 채널 결정: 대댓글은 부모 채널을 강제로 따른다 (답글에서 범위가 바뀌어 새는 것 방지)
  let channel: CommentChannel;
  let parent: string | null = null;
  if (parentId) {
    const p = await prisma.quoteComment.findUnique({
      where: { id: String(parentId) },
      select: { id: true, quoteId: true, visibility: true, parentId: true },
    });
    if (!p || p.quoteId !== id || !canSeeChannel(user.role, p.visibility)) {
      return NextResponse.json({ error: "답글을 달 댓글을 찾을 수 없습니다" }, { status: 404 });
    }
    // 1단계 스레드: 답글의 답글은 최상위 댓글 밑으로 붙인다
    parent = p.parentId ?? p.id;
    channel = p.visibility as CommentChannel;
  } else if (visibility === "dev" || visibility === "quote") {
    channel = visibility;
  } else {
    return NextResponse.json({ error: "채널을 선택해주세요" }, { status: 400 });
  }
  if (!canSeeChannel(user.role, channel)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // 같은 작성자가 10분 내 연속 댓글을 달면 이메일 중복 발송 억제 (채널별)
  const recentByAuthor = await prisma.quoteComment.findFirst({
    where: {
      quoteId: id,
      userId: user.id,
      visibility: channel,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  const comment = await prisma.quoteComment.create({
    data: {
      quoteId: id,
      userId: user.id,
      content: content.trim(),
      visibility: channel,
      parentId: parent,
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
      authorEmail: user.email,
      content: comment.content,
      channel,
      // 외주 견적은 외부 수신자(요청자)에게 알림을 보내지 않음
      requesterEmail: quote.isExternal ? null : quote.requesterEmail,
      createdByEmail: quote.createdBy?.email,
      assigneeEmail: quote.devAssignee?.email,
    }).catch((err) => console.error("[Email] 댓글 알림 실패:", err));
  }

  return NextResponse.json(comment, { status: 201 });
}
