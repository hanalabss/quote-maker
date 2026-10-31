import { test } from "node:test";
import assert from "node:assert/strict";
import { getMonthGrid, layoutWeek, type CalendarEvent } from "../src/lib/calendar";

const ev = (p: Partial<CalendarEvent> & { id: string; confirmedDate: string }): CalendarEvent => ({
  quoteNumber: p.id,
  eventName: p.id,
  type: "rental",
  eventEndDate: null,
  devDeadline: null,
  createdByName: null,
  ...p,
});

// 2026년 11월 그리드: 첫 주 = 11/1(일) ~ 11/7(토)
const weeks = getMonthGrid(2026, 10);

test("여러 날 행사는 주마다 막대 1개로 이어진다", () => {
  const e = ev({ id: "a", confirmedDate: "2026-11-05", eventEndDate: "2026-11-10" });
  const w1 = layoutWeek(weeks[0], [e]);
  assert.equal(w1.length, 1);
  assert.deepEqual([w1[0].startCol, w1[0].span, w1[0].continuesBefore, w1[0].continuesAfter], [4, 3, false, true]);
  const w2 = layoutWeek(weeks[1], [e]);
  assert.deepEqual([w2[0].startCol, w2[0].span, w2[0].continuesBefore, w2[0].continuesAfter], [0, 3, true, false]);
});

test("겹치는 행사는 다른 줄, 겹치지 않으면 같은 줄을 재사용", () => {
  const segs = layoutWeek(weeks[1], [
    ev({ id: "long", confirmedDate: "2026-11-08", eventEndDate: "2026-11-12" }),
    ev({ id: "mid", confirmedDate: "2026-11-10", eventEndDate: "2026-11-11" }),
    ev({ id: "late", confirmedDate: "2026-11-13", eventEndDate: "2026-11-14" }),
  ]);
  const lane = (id: string) => segs.find((s) => s.event.id === id)!.lane;
  assert.equal(lane("long"), 0);
  assert.equal(lane("mid"), 1);
  assert.equal(lane("late"), 0);
});

test("개발 마감은 1일 표시로 따로 배치, 행사 막대보다 아래 줄", () => {
  const segs = layoutWeek(weeks[1], [
    ev({ id: "x", confirmedDate: "2026-11-08", eventEndDate: "2026-11-14", devDeadline: "2026-11-11" }),
  ]);
  const dl = segs.find((s) => s.kind === "deadline")!;
  assert.deepEqual([dl.startCol, dl.span, dl.lane], [3, 1, 1]);
});

test("범위 밖 행사는 표시 안 함, 종료일이 시작일보다 빠르면 하루짜리", () => {
  assert.equal(layoutWeek(weeks[0], [ev({ id: "dec", confirmedDate: "2026-12-20" })]).length, 0);
  const s = layoutWeek(weeks[0], [ev({ id: "bad", confirmedDate: "2026-11-03", eventEndDate: "2026-11-01" })]);
  assert.equal(s[0].span, 1);
});

test("배포 완료·행사 완료 건은 마감 표시 안 함", () => {
  const base = { confirmedDate: "2026-11-12", devDeadline: "2026-11-10" };
  assert.equal(layoutWeek(weeks[1], [ev({ id: "d", ...base, devCompletedAt: "2026-11-09T00:00:00Z" })]).filter((s) => s.kind === "deadline").length, 0);
  assert.equal(layoutWeek(weeks[1], [ev({ id: "c", ...base, status: "completed" })]).filter((s) => s.kind === "deadline").length, 0);
  assert.equal(layoutWeek(weeks[1], [ev({ id: "p", ...base, status: "confirmed" })]).filter((s) => s.kind === "deadline").length, 1);
});
