import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id, commentId } = await params;
  const { content, visibility } = await request.json();

  const comment = await prisma.quoteComment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.quoteId !== id) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
  }

  // 채널 이동 — dev(관리자)만. 개발 채널에 금액이 올라온 경우 견적 협의로 옮기는 용도.
  // 최상위 댓글만 옮길 수 있고, 답글은 함께 따라간다.
  if (visibility !== undefined) {
    if (user.role !== "dev") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    if (visibility !== "quote" && visibility !== "dev") {
      return NextResponse.json({ error: "채널이 올바르지 않습니다" }, { status: 400 });
    }
    if (comment.parentId) {
      return NextResponse.json({ error: "답글은 따로 옮길 수 없습니다. 원 댓글을 옮겨주세요" }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.quoteComment.update({ where: { id: commentId }, data: { visibility } }),
      prisma.quoteComment.updateMany({ where: { parentId: commentId }, data: { visibility } }),
    ]);
    return NextResponse.json({ moved: true, visibility });
  }

  if (!content?.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요" }, { status: 400 });
  }

  // 본인 댓글만 수정 가능
  if (comment.userId !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const updated = await prisma.quoteComment.update({
    where: { id: commentId },
    data: { content: content.trim() },
    include: {
      user: { select: { name: true, role: true, team: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id, commentId } = await params;

  const comment = await prisma.quoteComment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.quoteId !== id) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
  }

  // 본인 댓글이거나 dev만 삭제 가능
  if (comment.userId !== user.id && user.role !== "dev") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  await prisma.quoteComment.delete({ where: { id: commentId } });

  return NextResponse.json({ deleted: true });
}
