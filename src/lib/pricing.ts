interface PricingItem {
  moduleCode: string;
  moduleName: string;
  description: string | null;
  unitPrice: number;
  quantity: number;
  amount: number;
}

interface PricingResult {
  items: PricingItem[];
  subtotal: number;
  vat: number;
  totalAmount: number;
}

export function calculateQuote(
  selectedModules: { code: string; name: string; description: string | null; basePrice: number }[],
  priceRate: number = 1.0
): PricingResult {
  const items: PricingItem[] = selectedModules.map((mod) => {
    const adjustedPrice = Math.round(mod.basePrice * priceRate);
    return {
      moduleCode: mod.code,
      moduleName: mod.name,
      description: mod.description,
      unitPrice: adjustedPrice,
      quantity: 1,
      amount: adjustedPrice,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vat = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + vat;

  return { items, subtotal, vat, totalAmount };
}

export function applyPriceRate(basePrice: number, priceRate: number): number {
  return Math.round(basePrice * priceRate);
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function amountToKorean(amount: number): string {
  const units = ["", "만", "억", "조"];
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];

  if (amount === 0) return "영";

  let result = "";
  let unitIndex = 0;
  let remaining = amount;

  while (remaining > 0) {
    const chunk = remaining % 10000;
    if (chunk > 0) {
      let chunkStr = "";
      const thousands = Math.floor(chunk / 1000);
      const hundreds = Math.floor((chunk % 1000) / 100);
      const tens = Math.floor((chunk % 100) / 10);
      const ones = chunk % 10;

      if (thousands > 0) chunkStr += (thousands === 1 ? "" : digits[thousands]) + "천";
      if (hundreds > 0) chunkStr += (hundreds === 1 ? "" : digits[hundreds]) + "백";
      if (tens > 0) chunkStr += (tens === 1 ? "" : digits[tens]) + "십";
      if (ones > 0) chunkStr += digits[ones];

      result = chunkStr + units[unitIndex] + result;
    }
    remaining = Math.floor(remaining / 10000);
    unitIndex++;
  }

  return "일금" + result + "원정";
}
