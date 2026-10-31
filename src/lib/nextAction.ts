// 견적별 "다음 차례" 판정 (홈·목록·상세 공용)
// 원칙: 견적마다 지금 움직여야 할 주체 1명과 그 행동 한 줄을 정한다.
//  - 검토중인데 마지막 댓글이 개발팀이면 개발팀이 질문하고 기다리는 중 → 사업팀 차례
//  - 승인 후에는 고객 회신을 받아 사업팀이 확정/보류/미진행을 입력
//  - 확정 후 미배포는 개발팀, 행사 종료 후에는 완료 처리, 완료 후 입금 미기록은 관리
import { getLifecycleBadge, type LifecycleInput } from "./lifecycle";
import { settlementBaseDate, settlementDates } from "./settlement";

const fmtMD = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export type Actor = "sales" | "dev" | "client" | null;

export interface NextActionInput extends LifecycleInput {
  lastCommentRole?: string | null; // 가장 최근 댓글 작성자 role
  createdByRole?: string | null; // 견적 작성자 role (dev가 직접 작성한 견적은 검토 단계가 없음)
  depositPaidAt?: string | null;
  balancePaidAt?: string | null;
}

export type NextActionTone = "action" | "wait" | "warn" | "done";

export interface NextAction {
  actor: Actor;
  label: string;
  tone: NextActionTone;
}

export const ACTOR_LABELS: Record<Exclude<Actor, null>, string> = {
  sales: "사업팀",
  dev: "개발팀",
  client: "고객사",
};

const isDevRole = (role?: string | null) => role === "dev" || role === "dev_staff";

export function getNextAction(q: NextActionInput, today: string): NextAction {
  const badge = getLifecycleBadge(q, today);

  switch (q.status) {
    case "draft":
      return { actor: "sales", label: "요청서 작성 마무리 후 제출", tone: "action" };
    case "pending":
      // 개발팀이 직접 작성·발송한 견적(외주·대형 건)은 대기중 = 고객 회신 대기로 쓰인다
      if (isDevRole(q.createdByRole)) {
        return { actor: "client", label: "직접 작성 견적 · 고객 회신 대기", tone: "wait" };
      }
      return { actor: "dev", label: "검토 대기", tone: "action" };
    case "reviewing":
      if (isDevRole(q.lastCommentRole)) {
        return { actor: "sales", label: "개발팀 질문에 답하기", tone: "action" };
      }
      return { actor: "dev", label: "검토·승인", tone: "action" };
    case "approved":
      if (badge?.kind === "event-passed") {
        return { actor: "sales", label: "행사일 지남 · 미진행 정리", tone: "warn" };
      }
      return { actor: "sales", label: "고객 회신 받아 확정·보류·미진행 입력", tone: "action" };
    case "on_hold":
      if (badge?.kind === "event-passed") {
        return { actor: "sales", label: "행사일 지남 · 미진행 정리", tone: "warn" };
      }
      return { actor: "client", label: "보류 중 · 고객 결정 대기", tone: "wait" };
    case "confirmed":
      if (badge?.kind === "awaiting-complete") {
        return { actor: "dev", label: "행사 종료 · 완료 처리", tone: "warn" };
      }
      if (badge?.kind === "deploy-missing") {
        return { actor: "dev", label: "행사 시작 · 배포 기록 없음", tone: "warn" };
      }
      if (badge?.kind === "overdue") {
        return { actor: "dev", label: `개발 납기 ${badge.days}일 초과`, tone: "warn" };
      }
      if (badge?.kind === "dday") {
        return { actor: "dev", label: badge.days === 0 ? "개발 납기 오늘" : `개발 중 · 납기 D-${badge.days}`, tone: "action" };
      }
      if (badge?.kind === "deployed") {
        const running = !!q.confirmedDate && q.confirmedDate <= today;
        return { actor: null, label: running ? "행사 진행 중" : "배포 완료 · 행사 대기", tone: "wait" };
      }
      return { actor: "dev", label: "개발 일정 입력", tone: "action" };
    case "completed": {
      if (q.depositPaidAt && q.balancePaidAt) {
        return { actor: null, label: "정산 완료", tone: "done" };
      }
      // 월 단위 정산: 행사 종료 달 말일이 지나야 입금 확인이 할 일이 된다
      const base = settlementBaseDate(q);
      if (base) {
        const { thisMonthEnd } = settlementDates(base);
        if (today <= thisMonthEnd) {
          return { actor: null, label: `정산 대기 · ${fmtMD(thisMonthEnd)} 이후 입금 확인`, tone: "wait" };
        }
      }
      return { actor: "dev", label: q.depositPaidAt ? "잔금 입금 확인" : "입금 확인", tone: "action" };
    }
    case "rejected":
      // 반려는 종결 상태 — 재요청은 새 견적으로 하므로 누구의 할 일도 아니다
      return { actor: null, label: "반려", tone: "done" };
    case "lost":
      return { actor: null, label: "미진행", tone: "done" };
    default:
      return { actor: null, label: "", tone: "done" };
  }
}

/**
 * 홈 정렬 우선순위 (작을수록 위). 경고 → 검토·회신 → 개발 → 고객 전달 후 입력 → 입금 기록.
 * 이미 끝난 행사의 입금 기록이 납기 걸린 개발 건을 덮지 않도록 단계로 먼저 나눈다.
 */
export function actionPriority(a: NextAction, status: string): number {
  if (a.tone === "warn") return 0;
  if (status === "pending" || status === "reviewing" || status === "draft") return 1;
  if (status === "confirmed") return 2;
  if (status === "approved" || status === "on_hold") return 3;
  if (status === "completed") return 5;
  return 4;
}

/** role이 이 행동의 주체인가 (dev_staff는 개발팀 차례 중 개발·배포만 해당) */
export function isMyTurn(action: NextAction, role: string | null | undefined, q?: { status: string }): boolean {
  if (!action.actor || !role) return false;
  if (role === "dev") return action.actor === "dev";
  if (role === "dev_staff") return action.actor === "dev" && q?.status === "confirmed";
  if (role === "sales") return action.actor === "sales";
  return false;
}
