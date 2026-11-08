import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessQuote,
  canSeeChannel,
  commentWhere,
  looksLikePrice,
  quoteScopeWhere,
  visibleChannels,
} from "../src/lib/quoteAccess";

const dev = { id: "u-dev", role: "dev" };
const sales = { id: "u-sales", role: "sales" };
const staff = { id: "u-staff", role: "dev_staff" };
const q = (p: Partial<{ createdById: string | null; isExternal: boolean; devAssigneeId: string | null }> = {}) => ({
  createdById: "u-sales",
  isExternal: false,
  devAssigneeId: null,
  ...p,
});

test("dev_staff는 담당 견적만 접근", () => {
  assert.equal(canAccessQuote(staff, q()), false);
  assert.equal(canAccessQuote(staff, q({ devAssigneeId: "u-staff" })), true);
  assert.equal(canAccessQuote(staff, q({ devAssigneeId: "u-other" })), false);
  // 외주는 담당이어도 dev만
  assert.equal(canAccessQuote(staff, q({ devAssigneeId: "u-staff", isExternal: true })), false);
});

test("sales는 본인 견적만, dev는 전부", () => {
  assert.equal(canAccessQuote(sales, q()), true);
  assert.equal(canAccessQuote(sales, q({ createdById: "u-x" })), false);
  assert.equal(canAccessQuote(sales, q({ isExternal: true })), false);
  assert.equal(canAccessQuote(dev, q({ isExternal: true, createdById: "u-x" })), true);
});

test("목록 where", () => {
  assert.deepEqual(quoteScopeWhere(dev), {});
  assert.deepEqual(quoteScopeWhere(sales), { isExternal: false, createdById: "u-sales" });
  assert.deepEqual(quoteScopeWhere(staff), { isExternal: false, devAssigneeId: "u-staff" });
});

test("댓글 채널: dev_staff는 개발 채널만", () => {
  assert.deepEqual(visibleChannels("dev_staff"), ["dev"]);
  assert.deepEqual(visibleChannels("sales"), ["quote", "dev"]);
  assert.deepEqual(visibleChannels("dev"), ["quote", "dev"]);
  assert.equal(canSeeChannel("dev_staff", "quote"), false);
  assert.equal(canSeeChannel("dev_staff", "dev"), true);
  assert.equal(canSeeChannel("sales", "quote"), true);
  assert.deepEqual(commentWhere("dev_staff"), { visibility: "dev" });
  assert.deepEqual(commentWhere("dev"), {});
});

test("금액 표현 감지 (인원·수량은 제외)", () => {
  for (const t of ["770,000원 입니다", "15만 추가", "15만원", "+150K", "935,000", "3천원"]) {
    assert.equal(looksLikePrice(t), true, t);
  }
  for (const t of ["5,000명 예상", "1만명", "시안 3장 수령", "11/14 잠실", "납기 2주", "카드 1,500매"]) {
    assert.equal(looksLikePrice(t), false, t);
  }
});
