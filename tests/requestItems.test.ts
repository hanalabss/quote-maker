import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequestItems, deriveSelection, toggleModuleCode, type ModuleLike, type RequestSelection } from "../src/lib/requestItems";

// 운영 모듈 마스터 발췌 (2026-11-01)
const MODULES: ModuleLike[] = [
  { id: "m-ui", code: "UI_BASIC", name: "키오스크 UI 개발", description: "키오스크 화면 UI 디자인 및 개발", basePrice: 200000 },
  { id: "m-cam", code: "CAM_PHOTO", name: "카메라/촬영 기능", description: "웹캠 연동 사진 촬영 및 미리보기 기능", basePrice: 150000 },
  { id: "m-qr", code: "QR_UPLOAD", name: "QR코드 업로드", description: "QR코드 스캔을 통한 이미지/데이터 업로드", basePrice: 150000 },
  { id: "m-text", code: "TEXT_INPUT", name: "텍스트 입력 기능", description: "이름, 닉네임 등 텍스트 입력 및 키보드 UI", basePrice: 150000 },
  { id: "m-sel", code: "SELECT_PRINT", name: "이미지 선택/인쇄 기능", description: "업로드 이미지 선택 및 출력", basePrice: 150000 },
  { id: "m-ks", code: "KSNET_PAY", name: "KSNET 결제 시스템 연동", description: "KSNET 실결제 연동", basePrice: 300000 },
  { id: "m-sdk", code: "PRINT_SDK", name: "인쇄/출력 및 Printer SDK 연동", description: "카드/사진/티켓 인쇄 출력 로직 및 Printer SDK 연동 (단순 insert/out 포함)", basePrice: 100000 },
  { id: "m-qa", code: "TEST_QA", name: "테스트 및 유지보수", description: "개발 완료 후 테스트, 현장 리허설 및 행사 당일 유지보수", basePrice: 100000, isAutoIncluded: true },
];

function sel(partial: Partial<RequestSelection>): RequestSelection {
  return { selectedModules: [], screenComposition: [], useKsnetPayment: false, useDbLogging: false, ...partial };
}

test("KLA(QT-20261030-002) 요청을 그대로 재현 — 6항목 850,000", () => {
  const r = buildRequestItems({
    selection: sel({
      selectedModules: ["UI_BASIC", "CAM_PHOTO", "TEXT_INPUT", "PRINT_SDK"],
      screenComposition: ["splash", "camera", "printing", "complete", "select_print"],
    }),
    modules: MODULES,
    priceRate: 1,
    screenDevice: "kiosk",
  });
  assert.deepEqual(
    r.items.map((it) => [it.itemName, it.amount]),
    [
      ["키오스크 UI 개발", 200000],
      ["카메라/촬영 기능", 150000],
      ["텍스트 입력 기능", 150000],
      ["인쇄/출력 및 Printer SDK 연동", 100000],
      ["테스트 및 유지보수", 100000],
      ["선택 인쇄 기능", 150000],
    ]
  );
  assert.equal(r.items[0].description, "스플래시 → 카메라 촬영 → 인쇄 진행 중 → 인쇄 완료 → 선택 인쇄");
  assert.deepEqual([r.subtotal, r.vat, r.totalAmount], [850000, 85000, 935000]);
  assert.deepEqual(r.items.map((it) => it.sortOrder), [1, 2, 3, 4, 5, 6]);
});

test("선택 인쇄를 모듈 카드와 화면 구성 둘 다 켜도 1회만 (배그 부산 중복 사례)", () => {
  const r = buildRequestItems({
    selection: sel({ selectedModules: ["UI_BASIC", "SELECT_PRINT", "PRINT_SDK"], screenComposition: ["select_print"] }),
    modules: MODULES,
    priceRate: 1,
  });
  assert.equal(r.items.filter((it) => it.itemName === "선택 인쇄 기능").length, 1);
  assert.equal(r.subtotal, 200000 + 100000 + 100000 + 150000);
});

test("KSNET은 모듈·토글 둘 다 켜도 1회, 가맹점 코드는 비고", () => {
  const r = buildRequestItems({
    selection: sel({ selectedModules: ["KSNET_PAY", "UI_BASIC"], useKsnetPayment: true }),
    modules: MODULES,
    priceRate: 1,
    ksnetMerchantId: "1234",
  });
  const ks = r.items.filter((it) => it.itemName === "KSNET 결제 시스템 연동");
  assert.equal(ks.length, 1);
  assert.equal(ks[0].note, "가맹점: 1234");
  assert.equal(ks[0].moduleId, "m-ks");
});

test("유형 배율·태블릿 항목명·DB 로그(0원 서비스)", () => {
  const r = buildRequestItems({
    selection: sel({ selectedModules: ["UI_BASIC"], useDbLogging: true }),
    modules: MODULES,
    priceRate: 0.3,
    screenDevice: "tablet",
  });
  assert.equal(r.items[0].itemName, "태블릿 UI 개발");
  assert.equal(r.items[0].unitPrice, 60000);
  const db = r.items.find((it) => it.itemName === "DB 직접 연결 로그");
  assert.equal(db?.amount, 0);
  assert.equal(db?.note, "서비스");
});

test("선택 안 한 선택 인쇄·KSNET 모듈은 조회돼 있어도 항목에 안 들어감", () => {
  const r = buildRequestItems({ selection: sel({ selectedModules: ["UI_BASIC"] }), modules: MODULES, priceRate: 1 });
  assert.deepEqual(r.items.map((it) => it.itemName), ["키오스크 UI 개발", "테스트 및 유지보수"]);
});

test("deriveSelection — 저장된 견적에서 선택 상태 복원 후 재산정하면 같은 항목", () => {
  const original = sel({
    selectedModules: ["UI_BASIC", "QR_UPLOAD", "TEXT_INPUT", "PRINT_SDK"],
    screenComposition: ["splash", "qr", "select_print"],
    useKsnetPayment: true,
    useDbLogging: true,
  });
  const built = buildRequestItems({ selection: original, modules: MODULES, priceRate: 1 });
  const restored = deriveSelection({
    items: built.items,
    screenComposition: JSON.stringify(original.screenComposition),
    modules: MODULES,
  });
  assert.deepEqual([...restored.selectedModules].sort(), [...original.selectedModules].sort());
  assert.deepEqual(restored.screenComposition, original.screenComposition);
  assert.equal(restored.useKsnetPayment, true);
  assert.equal(restored.useDbLogging, true);
  const rebuilt = buildRequestItems({ selection: restored, modules: MODULES, priceRate: 1 });
  assert.deepEqual(rebuilt.items, built.items);
});

test("deriveSelection — 화면 구성 없이 모듈로 켠 선택 인쇄는 모듈로 복원, 깨진 JSON은 빈 배열", () => {
  const built = buildRequestItems({ selection: sel({ selectedModules: ["UI_BASIC", "SELECT_PRINT"] }), modules: MODULES, priceRate: 1 });
  const restored = deriveSelection({ items: built.items, screenComposition: "not-json", modules: MODULES });
  assert.ok(restored.selectedModules.includes("SELECT_PRINT"));
  assert.deepEqual(restored.screenComposition, []);
});

test("toggleModuleCode — 화면 흐름 모듈을 켜면 UI·SDK 자동, 끌 때는 그대로", () => {
  assert.deepEqual(toggleModuleCode([], "CAM_PHOTO"), ["CAM_PHOTO", "PRINT_SDK", "UI_BASIC"]);
  assert.deepEqual(toggleModuleCode(["CAM_PHOTO", "PRINT_SDK", "UI_BASIC"], "CAM_PHOTO"), ["PRINT_SDK", "UI_BASIC"]);
  assert.deepEqual(toggleModuleCode([], "KSNET_PAY"), ["KSNET_PAY"]);
});
