// 견적 접근 범위 + 댓글 채널 — 목록·상세·댓글·첨부가 같은 기준을 쓰도록 한 곳에 모은다.
//
// 접근 범위
//   dev(관리자)   : 전부 (외주 포함)
//   sales         : 본인이 만든 견적만 (외주 제외)
//   dev_staff     : 개발 담당자로 지정된 견적만 (외주 제외)
//
// 댓글 채널
//   quote(견적 협의) : dev + sales. 금액 이야기 가능. dev_staff에게는 API·메일 모두 비노출
//   dev(개발)        : dev + sales + dev_staff. 시안·일정·장비 등. 금액 금지

export type CommentChannel = "quote" | "dev";
export const COMMENT_CHANNELS: CommentChannel[] = ["quote", "dev"];

type Viewer = { id: string; role: string };
type QuoteScope = { createdById: string | null; isExternal: boolean; devAssigneeId: string | null };

/** 목록 조회용 where 조건 (페이지별 추가 조건은 호출부에서 합친다) */
export function quoteScopeWhere(user: Viewer): Record<string, unknown> {
  if (user.role === "dev") return {};
  if (user.role === "dev_staff") return { isExternal: false, devAssigneeId: user.id };
  return { isExternal: false, createdById: user.id };
}

/** 단건 접근 가능 여부 */
export function canAccessQuote(user: Viewer, quote: QuoteScope): boolean {
  if (user.role === "dev") return true;
  if (quote.isExternal) return false;
  if (user.role === "dev_staff") return quote.devAssigneeId === user.id;
  return quote.createdById === user.id;
}

/** role이 볼 수 있는 댓글 채널 */
export function visibleChannels(role: string | null | undefined): CommentChannel[] {
  return role === "dev_staff" ? ["dev"] : COMMENT_CHANNELS;
}

export function canSeeChannel(role: string | null | undefined, channel: string): boolean {
  return visibleChannels(role).includes(channel as CommentChannel);
}

/** Prisma 댓글 필터 */
export function commentWhere(role: string | null | undefined) {
  return role === "dev_staff" ? { visibility: "dev" } : {};
}

/** 상세 응답용 comments include (채널 필터 포함) */
export function commentsInclude(role: string | null | undefined) {
  return {
    where: commentWhere(role),
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { name: true, role: true, team: true } } },
  };
}

/** 개발 채널에 금액으로 보이는 표현이 있는지 (작성 전 확인용 — 차단 아님) */
export function looksLikePrice(text: string): boolean {
  // 인원·수량(명/개/장/매/건/회)은 제외: "5,000명", "1만명"
  return /\d[\d,.]*\s*(?:만|천)?\s*원|\d[\d,.]*\s*만(?!\s*[명개장매건회])|\d[\d,.]*\s*K\b|\d{1,3}(?:,\d{3})+(?![\d,]|\s*[명개장매건회])/i.test(text);
}
