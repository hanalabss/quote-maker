import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "파일을 선택해주세요" }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `파일 크기가 20MB를 초과합니다: ${file.name}` },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${file.name}` },
          { status: 400 }
        );
      }

      const ext = path.extname(file.name) || "";
      const fileName = `${randomUUID()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error("Supabase 업로드 오류:", error);
        return NextResponse.json(
          { error: `파일 업로드 실패: ${file.name}` },
          { status: 500 }
        );
      }

      results.push({
        fileName,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("업로드 오류:", error);
    return NextResponse.json(
      { error: "파일 업로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
