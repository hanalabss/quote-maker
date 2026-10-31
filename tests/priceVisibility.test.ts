import { test } from "node:test";
import assert from "node:assert/strict";
import { canSeePrice, redactQuotePrices } from "../src/lib/priceVisibility";

const quote = {
  id: "q1",
  eventName: "테스트 행사",
  subtotal: 700000,
  vat: 70000,
  totalAmount: 770000,
  items: [
    { id: "i1", itemName: "키오스크 UI 개발", unitPrice: 200000, quantity: 1, amount: 200000 },
    { id: "i2", itemName: "카메라/촬영 기능", unitPrice: 150000, quantity: 1, amount: 150000 },
  ],
};

test("dev·sales만 금액 열람", () => {
  assert.equal(canSeePrice("dev"), true);
  assert.equal(canSeePrice("sales"), true);
  assert.equal(canSeePrice("dev_staff"), false);
  assert.equal(canSeePrice(undefined), false);
});

test("dev_staff 응답에는 금액 키가 아예 없다", () => {
  const r = redactQuotePrices(quote, "dev_staff") as Record<string, unknown>;
  for (const k of ["subtotal", "vat", "totalAmount"]) assert.equal(k in r, false, k);
  for (const item of r.items as Record<string, unknown>[]) {
    assert.equal("unitPrice" in item, false);
    assert.equal("amount" in item, false);
    assert.equal(typeof item.itemName, "string");
    assert.equal(item.quantity, 1);
  }
  assert.equal(r.eventName, "테스트 행사");
  // JSON 직렬화 결과에도 금액 숫자가 남지 않는다
  assert.equal(/770000|200000|150000/.test(JSON.stringify(r)), false);
});

test("원본 객체는 변경하지 않는다", () => {
  redactQuotePrices(quote, "dev_staff");
  assert.equal(quote.totalAmount, 770000);
  assert.equal(quote.items[0].unitPrice, 200000);
});

test("dev·sales는 원본 그대로, null은 null", () => {
  assert.equal(redactQuotePrices(quote, "dev"), quote);
  assert.equal(redactQuotePrices(quote, "sales"), quote);
  assert.equal(redactQuotePrices(null, "dev_staff"), null);
});
