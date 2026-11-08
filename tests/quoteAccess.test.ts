import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessQuote,
  canSeeChannel,
  commentWhere,
  looksLikePrice,
  pickCommentRecipients,
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

test("댓글 알림: 개발 채널은 사업팀 ↔ 담당자 1:1", () => {
  const base = { salesEmails: ["sales@x"], adminEmails: ["admin@x"], assigneeEmail: "staff@x" };
  // 사업팀 질문 → 담당자만 (관리자에게 안 감)
  assert.deepEqual(pickCommentRecipients({ ...base, channel: "dev", authorRole: "sales", authorEmail: "sales@x" }), ["staff@x"]);
  // 담당자 답변 → 사업팀
  assert.deepEqual(pickCommentRecipients({ ...base, channel: "dev", authorRole: "dev_staff", authorEmail: "staff@x" }), ["sales@x"]);
  // 관리자가 끼어들면 사업팀 + 담당자
  assert.deepEqual(pickCommentRecipients({ ...base, channel: "dev", authorRole: "dev", authorEmail: "admin@x" }), ["sales@x", "staff@x"]);
  // 담당 미지정 → 관리자
  assert.deepEqual(
    pickCommentRecipients({ ...base, assigneeEmail: null, channel: "dev", authorRole: "sales", authorEmail: "sales@x" }),
    ["admin@x"]
  );
});

test("댓글 알림: 견적 협의는 관리자 ↔ 사업팀, 담당자 제외", () => {
  const base = { salesEmails: ["sales@x"], adminEmails: ["admin@x"], assigneeEmail: "staff@x" };
  assert.deepEqual(pickCommentRecipients({ ...base, channel: "quote", authorRole: "sales", authorEmail: "sales@x" }), ["admin@x"]);
  assert.deepEqual(pickCommentRecipients({ ...base, channel: "quote", authorRole: "dev", authorEmail: "admin@x" }), ["sales@x"]);
});
