// 견적서 엑셀을 로컬로 직접 생성 (Next.js API 거치지 않음)
// 사용: node scripts/export-quote-local.js <quoteId> [outDir]
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const TYPE_LABELS = { sale: '판매', rental: '렌탈', re_event: '재행사' };

function formatKRW(n) { return new Intl.NumberFormat('ko-KR').format(n); }

function amountToKorean(amount) {
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  if (amount === 0) return '영';
  let result = '';
  let unitIndex = 0;
  let remaining = amount;
  while (remaining > 0) {
    const chunk = remaining % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      const thousands = Math.floor(chunk / 1000);
      const hundreds = Math.floor((chunk % 1000) / 100);
      const tens = Math.floor((chunk % 100) / 10);
      const ones = chunk % 10;
      if (thousands > 0) chunkStr += (thousands === 1 ? '' : digits[thousands]) + '천';
      if (hundreds > 0) chunkStr += (hundreds === 1 ? '' : digits[hundreds]) + '백';
      if (tens > 0) chunkStr += (tens === 1 ? '' : digits[tens]) + '십';
      if (ones > 0) chunkStr += digits[ones];
      result = chunkStr + units[unitIndex] + result;
    }
    remaining = Math.floor(remaining / 10000);
    unitIndex++;
  }
  return '일금' + result + '원정';
}

async function main() {
  const quoteId = process.argv[2];
  const outDir  = process.argv[3] || path.resolve(__dirname, '..', '..', '..', 'Desktop', 'external-quotes');
  if (!quoteId) { console.error('Usage: node export-quote-local.js <quoteId> [outDir]'); process.exit(1); }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!quote) { console.error('견적 없음:', quoteId); process.exit(1); }

  const thin = { style: 'thin' };
  const hair = { style: 'hair' };
  const thinBorder = { top: thin, bottom: thin, left: thin, right: thin };
  const itemBorder = { top: hair, bottom: hair, left: thin, right: thin };
  const itemBorderInner = { top: hair, bottom: hair };

  const wb = new ExcelJS.Workbook();
  wb.creator = '하나플랫폼';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  const ws = wb.addWorksheet('견적서', {
    views: [{ state: 'normal', showGridLines: true, zoomScale: 100 }],
  });

  ws.columns = [
    { width: 6.2 }, { width: 20 }, { width: 7.3 }, { width: 0.5 },
    { width: 5.7 }, { width: 28 }, { width: 13 }, { width: 13 }, { width: 18 },
  ];

  const FONT = '맑은 고딕';
  const baseFont = (extra) => ({ name: FONT, color: { argb: 'FF000000' }, ...extra });

  // Title
  ws.mergeCells('A1:I2');
  const titleCell = ws.getCell('A1');
  titleCell.value = '견      적      서';
  titleCell.font = baseFont({ size: 20, bold: true });
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = { top: thin, left: thin, right: thin, bottom: thin };
  ws.getCell('I1').border = { top: thin, right: thin };
  ws.getCell('I2').border = { right: thin, bottom: thin };
  ws.getCell('A2').border = { left: thin, bottom: thin };
  ws.getRow(1).height = 31.5;
  ws.getRow(2).height = 8.25;

  // Description + company info
  ws.mergeCells('A3:F9');
  const descCell = ws.getCell('A3');
  const typeLabel = TYPE_LABELS[quote.type] || quote.type;
  descCell.value = `해당 프로그램의 개발 단가를\n아래와 같이 견적하오니 검토바랍니다.\n[${typeLabel}]`;
  descCell.font = baseFont({ size: 12 });
  descCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  descCell.border = { top: thin, left: thin, bottom: thin };
  for (let r = 3; r <= 9; r++) {
    ws.getCell(`A${r}`).border = { left: thin };
    ws.getCell(`F${r}`).border = { right: thin };
  }
  ws.getCell('A3').border = { top: thin, left: thin };
  ws.getCell('F3').border = { top: thin, right: thin };
  ws.getCell('A9').border = { left: thin, bottom: thin };
  ws.getCell('F9').border = { right: thin, bottom: thin };

  ws.mergeCells('G3:I5');
  const companyCell = ws.getCell('G3');
  companyCell.value = '㈜하나플랫폼';
  companyCell.font = baseFont({ size: 11, bold: true });
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  companyCell.border = thinBorder;

  ws.mergeCells('G6:I6');
  ws.getCell('G6').value = '대 표   심  건  우';
  ws.getCell('G6').font = baseFont({ size: 10, bold: true });
  ws.getCell('G6').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('G6').border = { left: thin, right: thin };

  ws.mergeCells('G7:I7');
  ws.getCell('G7').value = '서울시 강서구 마곡중앙로 메가타워 710호';
  ws.getCell('G7').font = baseFont({ size: 9 });
  ws.getCell('G7').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('G7').border = { left: thin, right: thin };

  ws.mergeCells('G8:H9');
  ws.getCell('G8').value = '전화: 010-2489-9250';
  ws.getCell('G8').font = baseFont({ size: 10 });
  ws.getCell('G8').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('G8').border = { left: thin, bottom: thin };

  ws.mergeCells('I8:I9');
  ws.getCell('I8').value = '메일: hana@hanapf.kr';
  ws.getCell('I8').font = baseFont({ size: 10 });
  ws.getCell('I8').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('I8').border = { right: thin, bottom: thin };

  for (let r = 3; r <= 8; r++) ws.getRow(r).height = 19.5;
  ws.getRow(7).height = 18.75;
  ws.getRow(9).height = 13.5;

  // Payment terms
  ws.mergeCells('A10:I10');
  ws.getCell('A10').value = '* 지불조건 : 계약금 40%, 잔금 60% ';
  ws.getCell('A10').font = baseFont({ size: 10 });
  ws.getCell('A10').alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell('A10').border = thinBorder;
  ws.getRow(10).height = 19.5;

  // Total amount (rows 11-12)
  ws.mergeCells('A11:B12');
  const amtLabelCell = ws.getCell('A11');
  amtLabelCell.value = '견적금액(VAT 포함)';
  amtLabelCell.font = baseFont({ size: 12, bold: true });
  amtLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  amtLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  amtLabelCell.border = thinBorder;

  ws.mergeCells('C11:I12');
  const amtValueCell = ws.getCell('C11');
  amtValueCell.value = `${amountToKorean(quote.totalAmount)}  (\\${formatKRW(quote.totalAmount)})`;
  amtValueCell.font = baseFont({ size: 12, bold: true });
  amtValueCell.alignment = { horizontal: 'center', vertical: 'middle' };
  amtValueCell.border = thinBorder;
  ws.getRow(11).height = 19.5;
  ws.getRow(12).height = 14.25;

  // Header row 13
  const hr = 13;
  ws.mergeCells(`C${hr}:F${hr}`);
  const headerDefs = [
    { cell: `A${hr}`, text: '구분' },
    { cell: `B${hr}`, text: '항목' },
    { cell: `C${hr}`, text: '내    용' },
    { cell: `G${hr}`, text: '단  가' },
    { cell: `H${hr}`, text: '금  액' },
    { cell: `I${hr}`, text: '비  고' },
  ];
  for (const h of headerDefs) {
    const c = ws.getCell(h.cell);
    c.value = h.text;
    c.font = baseFont({ size: 10, bold: true });
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    c.border = thinBorder;
  }
  for (const col of ['D', 'E', 'F']) {
    ws.getCell(`${col}${hr}`).border = thinBorder;
    ws.getCell(`${col}${hr}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  }
  ws.getRow(hr).height = 15.75;

  // Items
  const itemCount = Math.max(quote.items.length, 4);
  for (let i = 0; i < itemCount; i++) {
    const r = hr + 1 + i;
    const item = quote.items[i];
    ws.mergeCells(`C${r}:F${r}`);

    const cellA = ws.getCell(`A${r}`);
    cellA.value = i + 1;
    cellA.font = baseFont({ size: 10 });
    cellA.alignment = { horizontal: 'center', vertical: 'middle' };
    cellA.border = itemBorder;

    const cellB = ws.getCell(`B${r}`);
    cellB.value = item?.itemName || '';
    cellB.font = baseFont({ size: 10 });
    cellB.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellB.border = itemBorder;

    const cellC = ws.getCell(`C${r}`);
    cellC.value = item?.description || '';
    cellC.font = baseFont({ size: 9 });
    cellC.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellC.border = itemBorder;

    for (const col of ['D', 'E']) {
      ws.getCell(`${col}${r}`).border = itemBorderInner;
    }
    ws.getCell(`F${r}`).border = { top: hair, bottom: hair, right: thin };

    const cellG = ws.getCell(`G${r}`);
    cellG.value = item?.unitPrice ?? null;
    cellG.numFmt = '#,##0';
    cellG.font = baseFont({ size: 10 });
    cellG.alignment = { horizontal: 'center', vertical: 'middle' };
    cellG.border = itemBorder;

    const cellH = ws.getCell(`H${r}`);
    cellH.value = item?.amount ?? null;
    cellH.numFmt = '#,##0';
    cellH.font = baseFont({ size: 10 });
    cellH.alignment = { horizontal: 'center', vertical: 'middle' };
    cellH.border = itemBorder;

    const cellI = ws.getCell(`I${r}`);
    // 필수/선택 마킹: isRequired=false 인 경우 비고 앞에 [선택] 표시 (협상 시 cut 가능 항목)
    let noteValue = item?.note || '';
    if (item && item.isRequired === false) {
      noteValue = noteValue ? `[선택] ${noteValue}` : '[선택]';
    }
    cellI.value = noteValue;
    cellI.font = baseFont({ size: 9 });
    cellI.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellI.border = itemBorder;

    const descLen = (item?.description || '').length;
    const nameLen = (item?.itemName || '').length;
    const maxLen = Math.max(descLen, nameLen);
    if (maxLen > 30) ws.getRow(r).height = Math.min(15.75 * Math.ceil(maxLen / 25), 80);
    else ws.getRow(r).height = 15.75;
  }

  // Total row
  const totalRow = hr + 1 + itemCount;
  ws.mergeCells(`A${totalRow}:F${totalRow}`);
  const totalLabelCell = ws.getCell(`A${totalRow}`);
  totalLabelCell.value = '계\n(VAT 포함)';
  totalLabelCell.font = baseFont({ size: 10, bold: true });
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  totalLabelCell.border = thinBorder;
  for (const col of ['B', 'C', 'D', 'E', 'F']) {
    ws.getCell(`${col}${totalRow}`).border = thinBorder;
  }
  const subtotalCell = ws.getCell(`G${totalRow}`);
  subtotalCell.value = quote.subtotal;
  subtotalCell.numFmt = '#,##0';
  subtotalCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtotalCell.font = baseFont({ size: 10, bold: true });
  subtotalCell.border = thinBorder;
  const totalCell = ws.getCell(`H${totalRow}`);
  totalCell.value = quote.totalAmount;
  totalCell.numFmt = '#,##0';
  totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totalCell.font = baseFont({ size: 10, bold: true });
  totalCell.border = thinBorder;
  ws.getCell(`I${totalRow}`).border = thinBorder;
  ws.getRow(totalRow).height = 36.75;

  // Note row — quote.notes가 있으면 그것 사용, 없으면 기본 보일러플레이트
  const defaultBoiler = '※ 본 견적은 상기 항목에 한하여 산출되었으며, 명시되지 않은 추가 개발, 기능 변경 및 현장 요청은 별도 협의 후 추가 비용이 발생할 수 있습니다.';
  const noteText = (quote.notes && quote.notes.trim()) ? quote.notes : defaultBoiler;
  const noteLines = noteText.split('\n').length;
  const noteRowSpan = Math.max(2, Math.ceil(noteLines * 1.2));
  const noteRowStart = totalRow + 1;
  const noteRowEnd = noteRowStart + noteRowSpan - 1;
  ws.mergeCells(`A${noteRowStart}:I${noteRowEnd}`);
  const noteCell = ws.getCell(`A${noteRowStart}`);
  noteCell.value = noteText;
  noteCell.font = { name: FONT, size: 9, color: { argb: 'FF666666' } };
  noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
  // 병합 영역 외곽 테두리
  for (let r = noteRowStart; r <= noteRowEnd; r++) {
    ws.getCell(`A${r}`).border = { left: thin };
    ws.getCell(`I${r}`).border = { right: thin };
    for (const col of ['B','C','D','E','F','G','H']) {
      if (r === noteRowStart) ws.getCell(`${col}${r}`).border = { top: thin };
      if (r === noteRowEnd)   ws.getCell(`${col}${r}`).border = { bottom: thin };
    }
  }
  ws.getCell(`A${noteRowStart}`).border = { top: thin, left: thin };
  ws.getCell(`I${noteRowStart}`).border = { top: thin, right: thin };
  ws.getCell(`A${noteRowEnd}`).border = { left: thin, bottom: thin };
  ws.getCell(`I${noteRowEnd}`).border = { right: thin, bottom: thin };
  // 행 높이: 줄당 약 18
  for (let r = noteRowStart; r <= noteRowEnd; r++) {
    ws.getRow(r).height = 18;
  }

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const safeEvent = (quote.eventName || 'quote').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
  const outPath = path.join(outDir, `${quote.quoteNumber}_${safeEvent}.xlsx`);
  await wb.xlsx.writeFile(outPath);
  console.log('생성 완료:', outPath);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
