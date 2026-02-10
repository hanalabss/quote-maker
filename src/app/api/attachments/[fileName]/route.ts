import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await params;

  // 경로 탈출 방지
  const safeName = path.basename(fileName);

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(safeName);

  if (!data?.publicUrl) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.redirect(data.publicUrl);
}
