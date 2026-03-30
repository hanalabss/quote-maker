import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface AuthUser {
  id: string;
  loginId: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
  position: string | null;
  phone: string | null;
}

/**
 * 쿠키에서 인증된 사용자 정보를 가져온 뒤 DB에서 검증한다.
 * 쿠키는 단순 JSON이므로 DB 조회로 무결성을 보장한다.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const c = await cookies();
  const raw = c.get("auth-user")?.value;
  if (!raw) return null;

  let parsed: { id?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed.id) return null;

  // DB에서 실제 사용자 정보 조회 (쿠키 위조 방지)
  const user = await prisma.user.findUnique({
    where: { id: parsed.id },
    select: {
      id: true,
      loginId: true,
      name: true,
      email: true,
      role: true,
      team: true,
      position: true,
      phone: true,
    },
  });

  return user as AuthUser | null;
}

/**
 * dev role 필수 인증. 실패 시 { error, status } 반환.
 */
export async function requireDev(): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getAuthUser();
  if (!user) return { error: "로그인이 필요합니다", status: 401 };
  if (user.role !== "dev") return { error: "권한이 없습니다", status: 403 };
  return { user };
}

/**
 * dev 또는 dev_staff role 필수 인증 (개발팀 전체).
 */
export async function requireDevTeam(): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getAuthUser();
  if (!user) return { error: "로그인이 필요합니다", status: 401 };
  if (user.role !== "dev" && user.role !== "dev_staff") return { error: "권한이 없습니다", status: 403 };
  return { user };
}

/**
 * 로그인 필수 인증 (role 무관). 실패 시 { error, status } 반환.
 */
export async function requireAuth(): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getAuthUser();
  if (!user) return { error: "로그인이 필요합니다", status: 401 };
  return { user };
}
