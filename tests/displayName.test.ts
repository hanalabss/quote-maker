import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_LEAD_LABEL, displayUserName } from "../src/lib/displayName";

const lead = { name: "장기훈", role: "dev" };
const staff = { name: "신동환", role: "dev_staff" };
const sales = { name: "김정남", role: "sales" };

test("사업팀이 보면 개발팀장 계정은 직함으로 보인다", () => {
  assert.equal(displayUserName(lead, "sales"), DEV_LEAD_LABEL);
  assert.equal(DEV_LEAD_LABEL, "개발팀장");
});

test("개발 담당으로 지정된 경우에는 사업팀에게도 실명", () => {
  assert.equal(displayUserName(lead, "sales", true), "장기훈");
  assert.equal(displayUserName(staff, "sales", true), "신동환");
});

test("개발팀이 보면 항상 실명", () => {
  assert.equal(displayUserName(lead, "dev"), "장기훈");
  assert.equal(displayUserName(lead, "dev_staff"), "장기훈");
});

test("개발팀장이 아닌 계정은 누구에게나 실명", () => {
  assert.equal(displayUserName(staff, "sales"), "신동환");
  assert.equal(displayUserName(sales, "sales"), "김정남");
  assert.equal(displayUserName(sales, "dev"), "김정남");
});
