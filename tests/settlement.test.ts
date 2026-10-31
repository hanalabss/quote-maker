import { test } from "node:test";
import assert from "node:assert/strict";
import { monthEnd, settlementDates, settlementBaseDate } from "../src/lib/settlement";
import { getNextAction } from "../src/lib/nextAction";

test("말일 계산: 30/31일, 2월, 연말 넘김", () => {
  assert.equal(monthEnd("2026-10-25"), "2026-10-31");
  assert.equal(monthEnd("2026-11-01"), "2026-11-30");
  assert.equal(monthEnd("2026-01-31", 1), "2026-02-28");
  assert.equal(monthEnd("2028-01-15", 1), "2028-02-29");
  assert.equal(monthEnd("2026-12-10", 1), "2027-01-31");
});

test("정산 기준일: 종료 달 말일 / 다음 달 말일", () => {
  assert.deepEqual(settlementDates("2026-10-25"), { thisMonthEnd: "2026-10-31", nextMonthEnd: "2026-11-30" });
  assert.equal(settlementBaseDate({ confirmedEndDate: null, eventEndDate: "2026-10-25", eventDate: "2026-10-24" }), "2026-10-25");
  assert.equal(settlementBaseDate({ confirmedDate: "2026-10-24" }), "2026-10-24");
});

test("완료 건: 종료 달 말일까지는 정산 대기, 지나면 입금 확인", () => {
  const done = { status: "completed", confirmedDate: "2026-10-25", confirmedEndDate: "2026-10-25" };
  const before = getNextAction(done, "2026-10-31");
  assert.equal(before.actor, null);
  assert.match(before.label, /정산 대기 · 10\/31 이후/);
  const after = getNextAction(done, "2026-11-01");
  assert.equal(after.actor, "dev");
  assert.equal(after.label, "입금 확인");
  assert.equal(getNextAction({ ...done, depositPaidAt: "2026-10-31" }, "2026-11-01").label, "잔금 입금 확인");
});
