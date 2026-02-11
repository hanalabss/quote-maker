import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";
import { amountToKorean, formatKRW } from "@/lib/pricing";
import { TYPE_LABELS } from "@/types";
import type { QuoteType } from "@/types";

// 공통 스타일
const thin: Partial<ExcelJS.Border> = { style: "thin" };
const thinBorder: Partial<ExcelJS.Borders> = {
  top: thin, bottom: thin, left: thin, right: thin,
};
const hairBottom: Partial<ExcelJS.Borders> = {
  left: thin, right: thin, bottom: { style: "hair" },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("견적서");

  // ── 열 너비: 원본 양식 기준 ──
  ws.columns = [
    { width: 6.2 },   // A: 구분
    { width: 20 },    // B: 항목
    { width: 7.3 },   // C: 내용 (병합 시작)
    { width: 0.5 },   // D: (숨김에 가까움)
    { width: 5.7 },   // E
    { width: 28 },    // F: 내용 (병합 끝)
    { width: 13 },    // G: 단가
    { width: 13 },    // H: 금액
    { width: 18 },    // I: 비고
  ];

  // ══════════════════════════════════════
  // Row 1~2: 타이틀
  // ══════════════════════════════════════
  ws.mergeCells("A1:I2");
  const titleCell = ws.getCell("A1");
  titleCell.value = "견      적      서";
  titleCell.font = { size: 20, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = { top: thin, left: thin, right: thin, bottom: thin };
  // 병합된 셀 우측/하단 테두리
  ws.getCell("I1").border = { top: thin, right: thin };
  ws.getCell("I2").border = { right: thin, bottom: thin };
  ws.getCell("A2").border = { left: thin, bottom: thin };
  ws.getRow(1).height = 31.5;
  ws.getRow(2).height = 8.25;

  // ══════════════════════════════════════
  // Row 3~9: 설명 + 회사 정보
  // ══════════════════════════════════════
  ws.mergeCells("A3:F9");
  const descCell = ws.getCell("A3");
  const typeLabel = TYPE_LABELS[quote.type as QuoteType] || quote.type;
  descCell.value = `해당 프로그램의 개발 단가를\n아래와 같이 견적하오니 검토바랍니다.\n[${typeLabel}]`;
  descCell.font = { size: 12 };
  descCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  descCell.border = { top: thin, left: thin, bottom: thin };
  // A3:F9 병합 영역 테두리 보강
  for (let r = 3; r <= 9; r++) {
    ws.getCell(`A${r}`).border = { left: thin };
    ws.getCell(`F${r}`).border = { right: thin };
  }
  ws.getCell("A3").border = { top: thin, left: thin };
  ws.getCell("F3").border = { top: thin, right: thin };
  ws.getCell("A9").border = { left: thin, bottom: thin };
  ws.getCell("F9").border = { right: thin, bottom: thin };

  // 회사 정보 (G3:I5)
  ws.mergeCells("G3:I5");
  const companyCell = ws.getCell("G3");
  companyCell.value = "㈜하나플랫폼";
  companyCell.font = { size: 11, bold: true };
  companyCell.alignment = { horizontal: "center", vertical: "middle" };
  companyCell.border = thinBorder;

  // 대표 (G6:I6)
  ws.mergeCells("G6:I6");
  ws.getCell("G6").value = "대 표   심  건  우";
  ws.getCell("G6").font = { size: 10, bold: true };
  ws.getCell("G6").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("G6").border = { left: thin, right: thin };

  // 주소 (G7:I7)
  ws.mergeCells("G7:I7");
  ws.getCell("G7").value = "서울시 강서구 마곡중앙로 메가타워 710호";
  ws.getCell("G7").font = { size: 9 };
  ws.getCell("G7").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("G7").border = { left: thin, right: thin };

  // 전화 (G8:H9)
  ws.mergeCells("G8:H9");
  ws.getCell("G8").value = "전화: 010-2489-9250";
  ws.getCell("G8").font = { size: 10 };
  ws.getCell("G8").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("G8").border = { left: thin, bottom: thin };

  // 메일 (I8:I9)
  ws.mergeCells("I8:I9");
  ws.getCell("I8").value = "메일: hana@hanapf.kr";
  ws.getCell("I8").font = { size: 10 };
  ws.getCell("I8").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("I8").border = { right: thin, bottom: thin };

  // Row 3~9 높이
  for (let r = 3; r <= 8; r++) ws.getRow(r).height = 19.5;
  ws.getRow(7).height = 18.75;
  ws.getRow(9).height = 13.5;

  // ══════════════════════════════════════
  // Row 10: 지불조건
  // ══════════════════════════════════════
  ws.mergeCells("A10:I10");
  ws.getCell("A10").value = "* 지불조건 : 계약금 40%, 잔금 60% ";
  ws.getCell("A10").font = { size: 10 };
  ws.getCell("A10").alignment = { horizontal: "right", vertical: "middle" };
  ws.getCell("A10").border = thinBorder;
  ws.getRow(10).height = 19.5;

  // ══════════════════════════════════════
  // Row 11~12: 견적금액 (2행 병합)
  // ══════════════════════════════════════
  ws.mergeCells("A11:B12");
  const amtLabelCell = ws.getCell("A11");
  amtLabelCell.value = "견적금액(VAT 포함)";
  amtLabelCell.font = { size: 12, bold: true };
  amtLabelCell.alignment = { horizontal: "center", vertical: "middle" };
  amtLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  amtLabelCell.border = thinBorder;

  ws.mergeCells("C11:I12");
  const amtValueCell = ws.getCell("C11");
  amtValueCell.value = `${amountToKorean(quote.totalAmount)}  (\\${formatKRW(quote.totalAmount)})`;
  amtValueCell.font = { size: 12, bold: true };
  amtValueCell.alignment = { horizontal: "center", vertical: "middle" };
  amtValueCell.border = thinBorder;

  ws.getRow(11).height = 19.5;
  ws.getRow(12).height = 14.25;

  // ══════════════════════════════════════
  // Row 13: 테이블 헤더
  // ══════════════════════════════════════
  const hr = 13;
  ws.mergeCells(`C${hr}:F${hr}`);

  const headerDefs = [
    { cell: `A${hr}`, text: "구분" },
    { cell: `B${hr}`, text: "항목" },
    { cell: `C${hr}`, text: "내    용" },
    { cell: `G${hr}`, text: "단  가" },
    { cell: `H${hr}`, text: "금  액" },
    { cell: `I${hr}`, text: "비  고" },
  ];

  for (const h of headerDefs) {
    const cell = ws.getCell(h.cell);
    cell.value = h.text;
    cell.font = { size: 10, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    cell.border = thinBorder;
  }
  for (const col of ["D", "E", "F"]) {
    ws.getCell(`${col}${hr}`).border = thinBorder;
    ws.getCell(`${col}${hr}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  }
  ws.getRow(hr).height = 15.75;

  // ══════════════════════════════════════
  // Row 14~: 항목 행
  // ══════════════════════════════════════
  const itemCount = Math.max(quote.items.length, 4);
  for (let i = 0; i < itemCount; i++) {
    const r = hr + 1 + i;
    const item = quote.items[i];

    ws.mergeCells(`C${r}:F${r}`);

    // A: 구분 번호
    const cellA = ws.getCell(`A${r}`);
    cellA.value = i + 1;
    cellA.font = { size: 10 };
    cellA.alignment = { horizontal: "center", vertical: "middle" };
    cellA.border = hairBottom;

    // B: 항목명
    const cellB = ws.getCell(`B${r}`);
    cellB.value = item?.itemName || "";
    cellB.font = { size: 10 };
    cellB.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cellB.border = hairBottom;

    // C: 내용 (설명)
    const cellC = ws.getCell(`C${r}`);
    cellC.value = item?.description || "";
    cellC.font = { size: 9 };
    cellC.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cellC.border = hairBottom;

    // 병합된 D~F 테두리
    for (const col of ["D", "E"]) {
      ws.getCell(`${col}${r}`).border = { bottom: { style: "hair" } };
    }
    ws.getCell(`F${r}`).border = { right: thin, bottom: { style: "hair" } };

    // G: 단가
    const cellG = ws.getCell(`G${r}`);
    cellG.value = item?.unitPrice || null;
    cellG.numFmt = "#,##0";
    cellG.font = { size: 10 };
    cellG.alignment = { horizontal: "center", vertical: "middle" };
    cellG.border = hairBottom;

    // H: 금액
    const cellH = ws.getCell(`H${r}`);
    cellH.value = item?.amount || null;
    cellH.numFmt = "#,##0";
    cellH.font = { size: 10 };
    cellH.alignment = { horizontal: "center", vertical: "middle" };
    cellH.border = hairBottom;

    // I: 비고
    const cellI = ws.getCell(`I${r}`);
    cellI.value = item?.note || "";
    cellI.font = { size: 9 };
    cellI.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cellI.border = hairBottom;

    ws.getRow(r).height = 15.75;
  }

  // ══════════════════════════════════════
  // 합계 행 (항목 바로 아래, 빈 행 없음)
  // ══════════════════════════════════════
  const totalRow = hr + 1 + itemCount;

  ws.mergeCells(`A${totalRow}:F${totalRow}`);
  const totalLabelCell = ws.getCell(`A${totalRow}`);
  totalLabelCell.value = "계\n(VAT 포함)";
  totalLabelCell.font = { size: 10, bold: true };
  totalLabelCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  totalLabelCell.border = thinBorder;

  for (const col of ["B", "C", "D", "E", "F"]) {
    ws.getCell(`${col}${totalRow}`).border = thinBorder;
  }

  const subtotalCell = ws.getCell(`G${totalRow}`);
  subtotalCell.value = quote.subtotal;
  subtotalCell.numFmt = "#,##0";
  subtotalCell.alignment = { horizontal: "center", vertical: "middle" };
  subtotalCell.font = { size: 10, bold: true };
  subtotalCell.border = thinBorder;

  const totalCell = ws.getCell(`H${totalRow}`);
  totalCell.value = quote.totalAmount;
  totalCell.numFmt = "#,##0";
  totalCell.alignment = { horizontal: "center", vertical: "middle" };
  totalCell.font = { size: 10, bold: true };
  totalCell.border = thinBorder;

  ws.getCell(`I${totalRow}`).border = thinBorder;
  ws.getRow(totalRow).height = 36.75;

  // ══════════════════════════════════════
  // 주의사항 (합계 바로 아래, 빈 행 없음)
  // ══════════════════════════════════════
  const noteRow = totalRow + 1;
  ws.mergeCells(`A${noteRow}:I${noteRow + 1}`);
  ws.getCell(`A${noteRow}`).value =
    "※ 본 견적은 상기 항목에 한하여 산출되었으며, 명시되지 않은 추가 개발, 기능 변경 및 현장 요청은 별도 협의 후 추가 비용이 발생할 수 있습니다.";
  ws.getCell(`A${noteRow}`).font = { size: 9, color: { argb: "FF666666" } };
  ws.getCell(`A${noteRow}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getCell(`A${noteRow}`).border = { top: thin, left: thin };
  ws.getCell(`A${noteRow + 1}`).border = { left: thin, bottom: thin };
  ws.getCell(`I${noteRow}`).border = { top: thin, right: thin };
  ws.getCell(`I${noteRow + 1}`).border = { right: thin, bottom: thin };
  // 하단 테두리 전체 (B~H)
  for (const col of ["B", "C", "D", "E", "F", "G", "H"]) {
    ws.getCell(`${col}${noteRow}`).border = { top: thin };
    ws.getCell(`${col}${noteRow + 1}`).border = { bottom: thin };
  }

  // ── 인쇄 설정 ──
  ws.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  };

  // Excel 버퍼 생성
  const arrayBuffer = await wb.xlsx.writeBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  const safeFilename = `${quote.quoteNumber}.xlsx`;

  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  headers.set("Content-Disposition", `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
  headers.set("Content-Length", String(uint8.byteLength));
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");

  return new Response(uint8, { status: 200, headers });
}
