// 금액 열람 권한 — dev_staff(개발 담당)는 금액 비노출.
// 화면 숨김만으로는 API 응답·Excel·메일로 새므로 서버 응답 단계에서 금액 필드를 제거한다.

export function canSeePrice(role: string | null | undefined): boolean {
  return role === "dev" || role === "sales";
}

const QUOTE_PRICE_KEYS = ["subtotal", "vat", "totalAmount"] as const;
const ITEM_PRICE_KEYS = ["unitPrice", "amount"] as const;

type WithItems = { items?: Record<string, unknown>[] } & Record<string, unknown>;

/** 견적 객체에서 금액 필드를 제거한 사본. 금액 열람 가능하면 원본 그대로 반환. */
export function redactQuotePrices<T extends object | null>(quote: T, role: string | null | undefined): T {
  if (quote === null || canSeePrice(role)) return quote;
  const copy: WithItems = { ...(quote as WithItems) };
  for (const k of QUOTE_PRICE_KEYS) delete copy[k];
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map((item) => {
      const it = { ...item };
      for (const k of ITEM_PRICE_KEYS) delete it[k];
      return it;
    });
  }
  return copy as T;
}
