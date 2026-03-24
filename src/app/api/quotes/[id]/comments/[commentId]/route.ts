import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { commentId } = await params;

  const comment = await prisma.quoteComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
  }

  // 본인 댓글이거나 dev만 삭제 가능
  if (comment.userId !== user.id && user.role !== "dev") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  await prisma.quoteComment.delete({ where: { id: commentId } });

  return NextResponse.json({ deleted: true });
}
