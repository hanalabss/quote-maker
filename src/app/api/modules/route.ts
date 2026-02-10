import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const modules = await prisma.module.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(modules);
}
