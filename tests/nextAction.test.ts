import { test } from "node:test";
import assert from "node:assert/strict";
import { getNextAction, isMyTurn, actionPriority, type NextActionInput } from "../src/lib/nextAction";

const TODAY = "2026-11-01";
const q = (p: Partial<NextActionInput>): NextActionInput => ({ status: "pending", ...p });

test("대기중은 개발팀 차례, 개발팀이 직접 작성한 견적은 고객 회신 대기", () => {
  assert.equal(getNextAction(q({ status: "pending" }), TODAY).actor, "dev");
  assert.equal(getNextAction(q({ status: "pending", createdByRole: "sales" }), TODAY).actor, "dev");
  assert.equal(getNextAction(q({ status: "pending", createdByRole: "dev" }), TODAY).actor, "client");
});

test("검토중: 마지막 댓글이 개발팀이면 사업팀 회신 차례, 아니면 개발팀", () => {
  assert.equal(getNextAction(q({ status: "reviewing", lastCommentRole: "dev" }), TODAY).actor, "sales");
  assert.equal(getNextAction(q({ status: "reviewing", lastCommentRole: "dev_staff" }), TODAY).actor, "sales");
  assert.equal(getNextAction(q({ status: "reviewing", lastCommentRole: "sales" }), TODAY).actor, "dev");
  assert.equal(getNextAction(q({ status: "reviewing" }), TODAY).actor, "dev");
});

test("승인: 사업팀이 고객 회신 입력, 행사일 지나면 정리 경고", () => {
  const a = getNextAction(q({ status: "approved", eventDate: "2026-11-20" }), TODAY);
  assert.equal(a.actor, "sales");
  assert.equal(a.tone, "action");
  const b = getNextAction(q({ status: "approved", eventDate: "2026-10-20" }), TODAY);
  assert.equal(b.actor, "sales");
  assert.equal(b.tone, "warn");
});

test("보류: 고객 대기, 행사일 지나면 사업팀 정리", () => {
  assert.equal(getNextAction(q({ status: "on_hold", eventDate: "2026-12-01" }), TODAY).actor, "client");
  assert.equal(getNextAction(q({ status: "on_hold", eventDate: "2026-10-01" }), TODAY).actor, "sales");
});

test("확정: 생애주기 배지에 따라 개발팀 행동", () => {
  const dday = getNextAction(q({ status: "confirmed", devDeadline: "2026-11-04", confirmedDate: "2026-11-10" }), TODAY);
  assert.equal(dday.actor, "dev");
  assert.match(dday.label, /D-3/);
  const over = getNextAction(q({ status: "confirmed", devDeadline: "2026-10-30", confirmedDate: "2026-11-10" }), TODAY);
  assert.equal(over.tone, "warn");
  const deployed = getNextAction(
    q({ status: "confirmed", devDeadline: "2026-10-30", devCompletedAt: "2026-10-29T00:00:00Z", confirmedDate: "2026-11-10" }),
    TODAY
  );
  assert.equal(deployed.actor, null);
  const ended = getNextAction(q({ status: "confirmed", confirmedDate: "2026-10-20", confirmedEndDate: "2026-10-22" }), TODAY);
  assert.equal(ended.actor, "dev");
  assert.match(ended.label, /완료 처리/);
});

test("완료: 입금 미기록이면 개발팀(관리), 모두 기록되면 끝", () => {
  assert.equal(getNextAction(q({ status: "completed" }), TODAY).label, "입금 확인");
  assert.equal(getNextAction(q({ status: "completed", depositPaidAt: "2026-10-01" }), TODAY).label, "잔금 입금 확인");
  assert.equal(getNextAction(q({ status: "completed", depositPaidAt: "2026-10-01", balancePaidAt: "2026-10-30" }), TODAY).actor, null);
});

test("isMyTurn: dev_staff는 확정 건의 개발팀 차례만", () => {
  const review = getNextAction(q({ status: "reviewing" }), TODAY);
  assert.equal(isMyTurn(review, "dev", { status: "reviewing" }), true);
  assert.equal(isMyTurn(review, "dev_staff", { status: "reviewing" }), false);
  const dev = getNextAction(q({ status: "confirmed", devDeadline: "2026-11-04", confirmedDate: "2026-11-10" }), TODAY);
  assert.equal(isMyTurn(dev, "dev_staff", { status: "confirmed" }), true);
  const pay = getNextAction(q({ status: "completed" }), TODAY);
  assert.equal(isMyTurn(pay, "dev_staff", { status: "completed" }), false);
  assert.equal(isMyTurn(review, "sales", { status: "reviewing" }), false);
});

test("배포 완료 후 행사 시작일이 되면 행사 진행 중", () => {
  const base = { status: "confirmed", devDeadline: "2026-10-28", devCompletedAt: "2026-10-27T00:00:00Z" };
  assert.equal(getNextAction(q({ ...base, confirmedDate: "2026-11-01", confirmedEndDate: "2026-11-01" }), TODAY).label, "행사 진행 중");
  assert.equal(getNextAction(q({ ...base, confirmedDate: "2026-11-05" }), TODAY).label, "배포 완료 · 행사 대기");
});

test("홈 정렬: 개발 건이 입금 기록보다 위, 경고가 맨 위", () => {
  const dev = getNextAction(q({ status: "confirmed", devDeadline: "2026-11-10", confirmedDate: "2026-11-14" }), TODAY);
  const pay = getNextAction(q({ status: "completed" }), TODAY);
  const warn = getNextAction(q({ status: "confirmed", confirmedDate: "2026-10-20", confirmedEndDate: "2026-10-22" }), TODAY);
  assert.ok(actionPriority(dev, "confirmed") < actionPriority(pay, "completed"));
  assert.ok(actionPriority(warn, "confirmed") < actionPriority(dev, "confirmed"));
});

test("반려는 종결 — 누구의 할 일도 아니다", () => {
  const a = getNextAction(q({ status: "rejected" }), TODAY);
  assert.equal(a.actor, null);
  assert.equal(isMyTurn(a, "sales", { status: "rejected" }), false);
});
