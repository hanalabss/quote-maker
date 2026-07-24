import { test } from "node:test";
import assert from "node:assert/strict";
import { getLifecycleBadge, diffDays, type LifecycleInput } from "../src/lib/lifecycle";

const TODAY = "2026-07-24";

function q(partial: Partial<LifecycleInput>): LifecycleInput {
  return { status: "confirmed", ...partial };
}

// ── 확정 외 상태: 배지 없음 ──────────────────────────────────
test("확정 외 상태는 항상 null", () => {
  for (const status of ["draft", "pending", "reviewing", "approved", "rejected", "lost", "completed"]) {
    assert.equal(
      getLifecycleBadge({ status, devDeadline: "2026-07-01", confirmedEndDate: "2026-07-10" }, TODAY),
      null,
      `status=${status}`
    );
  }
});

// ── 미배포 + 행사 전: devDeadline 기준 D-day/초과 ────────────
test("미배포·마감 D-3", () => {
  assert.deepEqual(getLifecycleBadge(q({ devDeadline: "2026-07-27", confirmedDate: "2026-08-01" }), TODAY), {
    kind: "dday",
    days: 3,
  });
});

test("미배포·마감 당일 → dday 0", () => {
  assert.deepEqual(getLifecycleBadge(q({ devDeadline: TODAY, confirmedDate: "2026-08-01" }), TODAY), {
    kind: "dday",
    days: 0,
  });
});

test("미배포·마감 1일 경과 → overdue 1", () => {
  assert.deepEqual(getLifecycleBadge(q({ devDeadline: "2026-07-23", confirmedDate: "2026-08-01" }), TODAY), {
    kind: "overdue",
    days: 1,
  });
});

test("미배포·마감 3일 경과 → overdue 3", () => {
  assert.deepEqual(getLifecycleBadge(q({ devDeadline: "2026-07-21" }), TODAY), { kind: "overdue", days: 3 });
});

test("미배포·devDeadline 없음·행사 전 → null", () => {
  assert.equal(getLifecycleBadge(q({ confirmedDate: "2026-08-01" }), TODAY), null);
});

test("날짜 정보 전무 → null", () => {
  assert.equal(getLifecycleBadge(q({}), TODAY), null);
});

// ── 미배포 + 행사 시작일 도래: 배포 미확인 ────────────────────
test("미배포·행사 시작 당일 → deploy-missing", () => {
  assert.deepEqual(
    getLifecycleBadge(q({ devDeadline: "2026-07-23", confirmedDate: TODAY, confirmedEndDate: "2026-07-30" }), TODAY),
    { kind: "deploy-missing" }
  );
});

test("미배포·행사 진행 중 → deploy-missing (마감 초과보다 우선)", () => {
  assert.deepEqual(
    getLifecycleBadge(
      q({ devDeadline: "2026-07-20", confirmedDate: "2026-07-22", confirmedEndDate: "2026-07-30" }),
      TODAY
    ),
    { kind: "deploy-missing" }
  );
});

test("미배포·행사 시작 지남·납기 미래 → dday (판매 건 등 행사일≠실제 행사, 납기 우선)", () => {
  assert.deepEqual(
    getLifecycleBadge(q({ devDeadline: "2026-07-28", confirmedDate: "2026-07-09" }), TODAY),
    { kind: "dday", days: 4 }
  );
});

test("미배포·행사 시작 당일·납기도 당일 → deploy-missing (납기 미래 아님)", () => {
  assert.deepEqual(
    getLifecycleBadge(q({ devDeadline: TODAY, confirmedDate: TODAY, confirmedEndDate: "2026-07-30" }), TODAY),
    { kind: "deploy-missing" }
  );
});

// ── 행사 종료 경과: 배포 여부 무관 완료 처리 대기 ─────────────
test("배포됨·행사 종료 1일 경과 → awaiting-complete", () => {
  assert.deepEqual(
    getLifecycleBadge(
      q({ devCompletedAt: "2026-07-15T09:00:00Z", confirmedDate: "2026-07-20", confirmedEndDate: "2026-07-23" }),
      TODAY
    ),
    { kind: "awaiting-complete" }
  );
});

test("미배포·행사 종료 경과 → awaiting-complete (배포 미확인 아님 — 과거 데이터 노이즈 방지)", () => {
  assert.deepEqual(
    getLifecycleBadge(
      q({ devDeadline: "2026-07-01", confirmedDate: "2026-07-10", confirmedEndDate: "2026-07-12" }),
      TODAY
    ),
    { kind: "awaiting-complete" }
  );
});

// ── 배포됨: 초과 표시 소멸 ───────────────────────────────────
test("배포됨·마감 초과였어도 → deployed", () => {
  assert.deepEqual(
    getLifecycleBadge(
      q({ devDeadline: "2026-07-20", devCompletedAt: "2026-07-23T02:00:00Z", confirmedDate: "2026-08-01" }),
      TODAY
    ),
    { kind: "deployed" }
  );
});

test("배포됨·행사 진행 중 → deployed", () => {
  assert.deepEqual(
    getLifecycleBadge(
      q({ devCompletedAt: "2026-07-20T02:00:00Z", confirmedDate: "2026-07-22", confirmedEndDate: "2026-07-30" }),
      TODAY
    ),
    { kind: "deployed" }
  );
});

test("배포됨·행사 종료 당일 → deployed (완료 대기는 다음날부터)", () => {
  assert.deepEqual(
    getLifecycleBadge(
      q({ devCompletedAt: "2026-07-20T02:00:00Z", confirmedDate: "2026-07-22", confirmedEndDate: TODAY }),
      TODAY
    ),
    { kind: "deployed" }
  );
});

test("배포됨·종료일 미입력 → deployed 유지", () => {
  assert.deepEqual(getLifecycleBadge(q({ devCompletedAt: "2026-07-20T02:00:00Z" }), TODAY), { kind: "deployed" });
});

// ── diffDays 경계 ────────────────────────────────────────────
test("diffDays 기본/월경계/동일일", () => {
  assert.equal(diffDays("2026-07-24", "2026-07-27"), 3);
  assert.equal(diffDays("2026-07-31", "2026-08-01"), 1);
  assert.equal(diffDays("2026-07-24", "2026-07-24"), 0);
  assert.equal(diffDays("2026-07-24", "2026-07-21"), -3);
});
