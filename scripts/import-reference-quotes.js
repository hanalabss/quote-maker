// 참고 견적 일괄 import
// 입력: C:\Users\jkh\Desktop\external-quotes\견적서\(원카드)*\*.xlsx
// 출력: ReferenceQuote + ReferenceQuoteItem 레코드 + 콘솔 sanity 표
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const ROOT = 'C:\\Users\\jkh\\Desktop\\external-quotes\\견적서';

// 셀 값 → 평문
function getText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v.text) return v.text;
    if (v.result !== undefined) return getText(v.result);
    if (v.formula !== undefined) return '';
  }
  return '';
}

// 셀 값 → 숫자 (formula result 우선)
function getNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  if (typeof v === 'object') {
    if (v.result !== undefined && typeof v.result === 'number') return v.result;
    if (v.result !== undefined) return getNum(v.result);
  }
  return null;
}

// 폴더명에서 메타 추출: "(원카드)20251119_신반포22차 아파트..." → {source, date, project}
function parseFolderName(folder) {
  // 패턴 A: (원카드)YYYYMMDD_프로젝트명
  let m = folder.match(/^\(([^)]+)\)(\d{8})_(.+)$/);
  if (m) {
    return {
      source: m[1].trim(),
      dateRaw: m[2],
      project: m[3].trim(),
    };
  }
  // 패턴 B: (원카드)프로젝트명 (날짜 없음)
  m = folder.match(/^\(([^)]+)\)(.+)$/);
  if (m) {
    return {
      source: m[1].trim(),
      dateRaw: null,
      project: m[2].trim(),
    };
  }
  return { source: '원카드시스템', dateRaw: null, project: folder };
}

// 파일명에서 날짜+revision 추출
function parseFileName(filename) {
  let date = null;
  let revision = 1;
  let isFinal = false;

  const dm = filename.match(/(\d{8})/);
  if (dm) date = `${dm[1].slice(0,4)}-${dm[1].slice(4,6)}-${dm[1].slice(6,8)}`;

  // revision: 단독 "N차" 패턴만 (앞에 다른 숫자가 없어야 함, "22차" 같은 경우 제외)
  // 예: "_2차", " 2차", "(2차" 매칭 / "22차", "32차" 미매칭
  if (/(^|[^0-9])([1-9])차(?![0-9])/.test(filename)) {
    const m = filename.match(/(^|[^0-9])([1-9])차(?![0-9])/);
    revision = parseInt(m[2], 10);
  }
  if (/최종|final/i.test(filename)) isFinal = true;

  return { date, revision, isFinal };
}

// 카테고리 추론
function inferCategory(projectName) {
  if (/내방객|방문/.test(projectName)) return '내방객';
  if (/출입통제|출입.*제어/.test(projectName)) return '출입통제';
  if (/스마트빌딩|smart.*building/i.test(projectName)) return '스마트빌딩';
  if (/커뮤니티|community/i.test(projectName)) return '커뮤니티';
  if (/입점각/.test(projectName)) return '입점각';
  return null;
}

// xlsx 1개 파싱
async function parseXlsx(filePath, folderMeta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  // 헤더 행 찾기 (B열에 "항목" 텍스트)
  let headerRow = -1;
  for (let r = 1; r <= ws.rowCount; r++) {
    const b = getText(ws.getCell(r, 2).value);
    if (b.trim() === '항목') { headerRow = r; break; }
  }
  if (headerRow < 0) throw new Error(`헤더 행(항목) 못 찾음: ${filePath}`);

  // 합계 행 찾기 (A열에 "계" 포함)
  let totalRow = -1;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const a = getText(ws.getCell(r, 1).value);
    if (/계.*VAT/.test(a)) { totalRow = r; break; }
  }
  if (totalRow < 0) totalRow = ws.rowCount;

  // 항목 추출 (헤더 다음부터 합계 직전까지)
  const items = [];
  for (let r = headerRow + 1; r < totalRow; r++) {
    const itemName = getText(ws.getCell(r, 2).value).trim();
    const desc = getText(ws.getCell(r, 3).value).trim();
    const unitPrice = getNum(ws.getCell(r, 7).value);
    const amount = getNum(ws.getCell(r, 8).value);
    const note = getText(ws.getCell(r, 9).value).trim();

    // skip rules: 빈 행, 노이즈 (비고·합계·구분자 텍스트)
    if (!itemName && !desc && !unitPrice && !amount) continue;
    if (/^[※*]/.test(itemName) || /^[※*]/.test(desc)) continue;
    if (/^계(\s|$|\(|\n)/.test(itemName)) continue;
    if (/VAT\s*포함/.test(itemName) && !unitPrice) continue;
    if (/지불조건|견적금액/.test(itemName)) continue;
    // 단가 0 + amount 0 → 의미 없는 항목
    if (!unitPrice && !amount) continue;

    items.push({
      sortOrder: items.length + 1,
      itemName: itemName || '(이름 없음)',
      description: desc || null,
      unitPrice: unitPrice || 0,
      quantity: 1,
      amount: amount || unitPrice || 0,
      note: note || null,
    });
  }

  // 합계 추출 (부동소수점 round)
  const subtotalRaw = getNum(ws.getCell(totalRow, 7).value) || items.reduce((s, x) => s + x.amount, 0);
  const totalAmountRaw = getNum(ws.getCell(totalRow, 8).value) || (subtotalRaw * 1.1);
  const subtotal = Math.round(subtotalRaw);
  const totalAmount = Math.round(totalAmountRaw);
  const vat = totalAmount - subtotal;

  // type 추출 (description 영역에서 [판매]/[렌탈]/[재행사])
  let type = 'sale';
  for (let r = 3; r <= 9; r++) {
    const a = getText(ws.getCell(r, 1).value);
    if (/\[렌탈\]/.test(a)) { type = 'rental'; break; }
    if (/\[재행사\]/.test(a)) { type = 're_event'; break; }
    if (/\[판매\]/.test(a)) { type = 'sale'; break; }
  }

  return { items, subtotal, vat, totalAmount, type };
}

// 폴더 1개 처리: xlsx 모두 파싱 + 부속 파일 attachments
async function processFolder(folderPath) {
  const folder = path.basename(folderPath);
  const meta = parseFolderName(folder);
  const all = fs.readdirSync(folderPath).filter(f => fs.statSync(path.join(folderPath, f)).isFile());

  const xlsxFiles = all.filter(f => /\.xlsx$/i.test(f) && !f.startsWith('~$'));
  const otherFiles = all.filter(f => !/\.xlsx$/i.test(f) && !f.startsWith('~$'));

  const records = [];
  for (const xfile of xlsxFiles) {
    const filePath = path.join(folderPath, xfile);
    const fname = parseFileName(xfile);
    let date = fname.date;
    let dateSource = 'filename';
    if (!date && meta.dateRaw) {
      date = `${meta.dateRaw.slice(0,4)}-${meta.dateRaw.slice(4,6)}-${meta.dateRaw.slice(6,8)}`;
      dateSource = 'folder';
    }
    if (!date) {
      // mtime fallback
      const mt = fs.statSync(filePath).mtime;
      const yyyy = mt.getFullYear();
      const mm = String(mt.getMonth() + 1).padStart(2, '0');
      const dd = String(mt.getDate()).padStart(2, '0');
      date = `${yyyy}-${mm}-${dd}`;
      dateSource = 'mtime';
      console.warn(`   ℹ️  날짜 추출 → mtime 사용: ${xfile} → ${date}`);
    }

    const parsed = await parseXlsx(filePath, meta);
    const attachments = otherFiles.map(f => {
      const fp = path.join(folderPath, f);
      const ext = path.extname(f).toLowerCase().slice(1);
      return {
        type: ext,
        fileName: f,
        localPath: fp,
        bytes: fs.statSync(fp).size,
      };
    });

    records.push({
      source: meta.source,
      projectName: meta.project,
      quoteDate: date,
      dateSource,
      revision: fname.revision,
      isFinal: fname.isFinal || (xlsxFiles.length === 1),
      category: inferCategory(meta.project),
      type: parsed.type,
      subtotal: parsed.subtotal,
      vat: parsed.vat,
      totalAmount: parsed.totalAmount,
      sourceFile: filePath,
      attachments,
      items: parsed.items,
      sourceXlsx: xfile,
    });
  }
  return records;
}

async function main() {
  const folders = fs.readdirSync(ROOT)
    .filter(f => fs.statSync(path.join(ROOT, f)).isDirectory())
    .filter(f => f.startsWith('('));

  console.log(`📁 ${folders.length}개 폴더 발견\n`);

  // 기존 데이터 정리 (재실행 시 중복 방지)
  const before = await prisma.referenceQuote.count();
  if (before > 0) {
    console.log(`🧹 기존 ReferenceQuote ${before}건 정리...`);
    await prisma.referenceQuote.deleteMany({});
  }

  let totalCount = 0;
  let totalRevenue = 0;
  const summary = [];

  for (const folder of folders) {
    const folderPath = path.join(ROOT, folder);
    console.log(`▶ ${folder}`);
    try {
      const records = await processFolder(folderPath);
      for (const rec of records) {
        const created = await prisma.referenceQuote.create({
          data: {
            source: rec.source,
            projectName: rec.projectName,
            quoteDate: rec.quoteDate,
            revision: rec.revision,
            isFinal: rec.isFinal,
            category: rec.category,
            type: rec.type,
            subtotal: rec.subtotal,
            vat: rec.vat,
            totalAmount: rec.totalAmount,
            sourceFile: rec.sourceFile,
            attachments: rec.attachments,
            items: { create: rec.items },
          },
        });
        totalCount++;
        totalRevenue += rec.totalAmount;
        summary.push({
          date: rec.quoteDate,
          source: rec.source,
          project: rec.projectName.slice(0, 40),
          rev: `${rec.revision}${rec.isFinal ? '*' : ''}`,
          items: rec.items.length,
          subtotal: rec.subtotal,
          total: rec.totalAmount,
          file: rec.sourceXlsx,
        });
        console.log(`   ✓ ${rec.sourceXlsx} → ${rec.items.length}항목, 합계 ${rec.totalAmount.toLocaleString()}원`);
      }
    } catch (err) {
      console.error(`   ✗ ${folder}: ${err.message}`);
    }
  }

  // Sanity check 표
  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('📊 Import 결과 (sanity check)');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('날짜       | 출처     | 프로젝트                                  | 차수 | 항목 |   공급가     |   합계');
  console.log('-----------|----------|-------------------------------------------|------|------|--------------|--------------');
  summary.sort((a, b) => a.date.localeCompare(b.date));
  for (const s of summary) {
    console.log(
      `${s.date} | ${s.source.padEnd(8)} | ${s.project.padEnd(40)} | ${s.rev.padEnd(4)} | ${String(s.items).padStart(4)} | ${s.subtotal.toLocaleString().padStart(12)} | ${s.total.toLocaleString().padStart(12)}`
    );
  }
  console.log('-----------|----------|-------------------------------------------|------|------|--------------|--------------');
  console.log(`총 ${totalCount}건 | 누적 매출 (VAT 포함): ${totalRevenue.toLocaleString()}원`);
  console.log('══════════════════════════════════════════════════════════════════════════════════════════');

  // 매출 분석
  console.log('\n📈 카테고리별 매출');
  const byCategory = {};
  for (const s of summary) {
    const cat = (await prisma.referenceQuote.findFirst({ where: { quoteDate: s.date, projectName: { startsWith: s.project } } }))?.category || '미분류';
    byCategory[cat] = (byCategory[cat] || 0) + s.total;
  }
  for (const [cat, sum] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(12)} : ${sum.toLocaleString().padStart(15)}원`);
  }

  console.log('\n📅 연도별 매출');
  const byYear = {};
  for (const s of summary) {
    const yr = s.date.slice(0, 4);
    byYear[yr] = (byYear[yr] || 0) + s.total;
  }
  for (const [yr, sum] of Object.entries(byYear).sort()) {
    console.log(`  ${yr}년 : ${sum.toLocaleString().padStart(15)}원`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
