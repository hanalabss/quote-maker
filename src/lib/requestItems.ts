// 사업팀 요청서(기능 선택·화면 구성) → 견적 항목 산정
// 견적 생성(POST /api/quotes)과 대기중 견적의 기능 수정(PATCH requestEdit)이 같은 규칙을 쓴다.

export interface RequestSelection {
  selectedModules: string[];
  screenComposition: string[];
  useKsnetPayment: boolean;
  useDbLogging: boolean;
}

export interface ModuleLike {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number;
  isAutoIncluded?: boolean;
}

export interface BuiltItem {
  moduleId: string | null;
  sortOrder: number;
  itemName: string;
  description: string | null;
  unitPrice: number;
  quantity: number;
  amount: number;
  note?: string;
}

export const SCREEN_FLOWS = [
  { value: "splash", label: "스플래시" },
  { value: "camera", label: "카메라 촬영" },
  { value: "qr", label: "QR 업로드" },
  { value: "select_print", label: "이미지 선택/인쇄" },
  { value: "text_input", label: "텍스트 입력" },
  { value: "printing", label: "인쇄 진행 중" },
  { value: "complete", label: "인쇄 완료" },
];

const SCREEN_LABELS: Record<string, string> = {
  splash: "스플래시",
  camera: "카메라 촬영",
  qr: "QR 업로드",
  image_select: "이미지 선택",
  select_print: "선택 인쇄",
  text_input: "텍스트 입력",
  printing: "인쇄 진행 중",
  complete: "인쇄 완료",
};

export const KSNET_PRICE = 300000;
export const SELECT_PRINT_PRICE = 150000;
const KSNET_NAME = "KSNET 결제 시스템 연동";
const SELECT_PRINT_NAME = "선택 인쇄 기능";
const DB_LOG_NAME = "DB 직접 연결 로그";

// 이 모듈 중 하나라도 켜면 PRINT_SDK·UI_BASIC 자동 선택
export const PRINT_SDK_TRIGGERS = ["CAM_PHOTO", "QR_UPLOAD", "TEXT_INPUT", "SELECT_PRINT"];

export function toggleModuleCode(selected: string[], code: string): string[] {
  const isSelected = selected.includes(code);
  let next = isSelected ? selected.filter((c) => c !== code) : [...selected, code];
  if (!isSelected && PRINT_SDK_TRIGGERS.includes(code)) {
    if (!next.includes("PRINT_SDK")) next = [...next, "PRINT_SDK"];
    if (!next.includes("UI_BASIC")) next = [...next, "UI_BASIC"];
  }
  return next;
}

/**
 * 선택 → 견적 항목. modules에는 선택된 모듈 + 자동 포함 모듈이 들어 있어야 한다.
 * 선택 인쇄·KSNET은 모듈 카드와 화면 구성/결제 토글 두 경로로 켤 수 있어 한 번만 넣는다.
 */
export function buildRequestItems(params: {
  selection: RequestSelection;
  modules: ModuleLike[];
  priceRate: number;
  screenDevice?: string | null;
  ksnetMerchantId?: string | null;
}): { items: BuiltItem[]; subtotal: number; vat: number; totalAmount: number } {
  const { selection, modules, priceRate, screenDevice, ksnetMerchantId } = params;
  const wantsSelectPrint =
    selection.screenComposition.includes("select_print") || selection.selectedModules.includes("SELECT_PRINT");
  const wantsKsnet = selection.useKsnetPayment || selection.selectedModules.includes("KSNET_PAY");

  const picked = modules.filter(
    (m) =>
      (selection.selectedModules.includes(m.code) || m.isAutoIncluded) &&
      m.code !== "SELECT_PRINT" &&
      m.code !== "KSNET_PAY"
  );
  // 기존 sortOrder 순서 유지 (자동 포함 모듈은 뒤)
  const ordered = [...picked.filter((m) => !m.isAutoIncluded), ...picked.filter((m) => m.isAutoIncluded)];
  const findId = (code: string) => modules.find((m) => m.code === code)?.id ?? null;

  const raw: Omit<BuiltItem, "sortOrder">[] = ordered.map((m) => {
    const price = Math.round(m.basePrice * priceRate);
    let itemName = m.name;
    let description = m.description;
    if (m.code === "UI_BASIC") {
      if (screenDevice === "tablet") itemName = "태블릿 UI 개발";
      else if (screenDevice === "laptop") itemName = "노트북 UI 개발";
      if (selection.screenComposition.length > 0) {
        description = selection.screenComposition.map((v) => SCREEN_LABELS[v] || v).join(" → ");
      }
    }
    return { moduleId: m.id, itemName, description, unitPrice: price, quantity: 1, amount: price };
  });

  if (wantsSelectPrint) {
    const price = Math.round(SELECT_PRINT_PRICE * priceRate);
    raw.push({
      moduleId: findId("SELECT_PRINT"),
      itemName: SELECT_PRINT_NAME,
      description: "업로드 이미지 선택 출력",
      unitPrice: price,
      quantity: 1,
      amount: price,
    });
  }
  if (wantsKsnet) {
    const price = Math.round(KSNET_PRICE * priceRate);
    raw.push({
      moduleId: findId("KSNET_PAY"),
      itemName: KSNET_NAME,
      description: "KSNET 실결제 연동, 카드 결제 테스트 및 검증, 실결제 환경 적용",
      unitPrice: price,
      quantity: 1,
      amount: price,
      note: ksnetMerchantId ? `가맹점: ${ksnetMerchantId}` : undefined,
    });
  }
  if (selection.useDbLogging) {
    raw.push({
      moduleId: null,
      itemName: DB_LOG_NAME,
      description: "인쇄 횟수/사용 통계 기록 (서비스)",
      unitPrice: 0,
      quantity: 1,
      amount: 0,
      note: "서비스",
    });
  }

  const items = raw.map((it, i) => ({ ...it, sortOrder: i + 1 }));
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const vat = Math.round(subtotal * 0.1);
  return { items, subtotal, vat, totalAmount: subtotal + vat };
}

/** 저장된 견적(항목·화면 구성)에서 요청서 선택 상태를 복원 — 기능 수정 모달 초기값 */
export function deriveSelection(params: {
  items: { moduleId: string | null; itemName: string }[];
  screenComposition: string | null;
  modules: ModuleLike[];
}): RequestSelection {
  const { items, modules } = params;
  let composition: string[] = [];
  try {
    const parsed = params.screenComposition ? JSON.parse(params.screenComposition) : [];
    if (Array.isArray(parsed)) composition = parsed.filter((v) => typeof v === "string");
  } catch {
    composition = [];
  }

  const codeById = new Map(modules.map((m) => [m.id, m]));
  const codes = new Set<string>();
  for (const it of items) {
    const m = it.moduleId ? codeById.get(it.moduleId) : undefined;
    if (m && !m.isAutoIncluded) codes.add(m.code);
  }
  const hasKsnet = codes.has("KSNET_PAY") || items.some((it) => it.itemName === KSNET_NAME);
  const hasSelectPrint = codes.has("SELECT_PRINT") || items.some((it) => it.itemName === SELECT_PRINT_NAME);
  codes.delete("KSNET_PAY");
  codes.delete("SELECT_PRINT");
  // 선택 인쇄는 화면 구성에 없을 때만 모듈로 켠다 (화면 구성에 있으면 그쪽이 출처)
  if (hasSelectPrint && !composition.includes("select_print")) codes.add("SELECT_PRINT");

  return {
    selectedModules: [...codes],
    screenComposition: composition,
    useKsnetPayment: hasKsnet,
    useDbLogging: items.some((it) => it.itemName === DB_LOG_NAME),
  };
}
