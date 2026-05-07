// 항목별 unit price baseline 분석
// 입력: ReferenceQuoteItem (예외 ReferenceQuote 제외)
// 출력: 정규화된 항목명별 시세 통계 (median/avg/p25/p75/n)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 항목명 정규화 — 같은 의미 항목들을 같은 그룹으로
function normalize(name) {
  let n = (name || '').toLowerCase();
  // 공통 노이즈 제거
  n = n.replace(/[\s\-·,()]/g, '');
  n = n.replace(/개발|구현|기능|작업|시스템|솔루션/g, '');
  // 도메인 키워드 매핑 (키워드 매치 → 통합 라벨)
  if (/내방신청|방문신청|신청.*웹|반응형.*신청/.test(n)) return 'frontend_visit_apply';
  if (/qr.*스캔|qr.*모바일|모바일.*신청/.test(n)) return 'frontend_qr_mobile';
  if (/키오스크|kiosk/.test(n)) return 'frontend_kiosk';
  if (/담당자.*승인|승인.*웹|승인.*화면/.test(n)) return 'frontend_approval';
  if (/관리자|어드민|admin/.test(n)) return 'frontend_admin';
  if (/통계|리포트|report/.test(n)) return 'feature_report';
  if (/api|백엔드|backend|서버/.test(n)) return 'backend_api';
  if (/db.*to.*db|에스원.*db|db.*연동/.test(n)) return 'integration_db';
  if (/본인인증|pass|인증/.test(n)) return 'integration_auth';
  if (/카카오|알림톡|sms|알림/.test(n)) return 'integration_notify';
  if (/qr.*발급|qr.*만료|qr.*코드/.test(n)) return 'feature_qr_token';
  if (/권한/.test(n)) return 'feature_permission';
  if (/예약/.test(n)) return 'feature_reservation';
  if (/락커|locker/.test(n)) return 'feature_locker';
  if (/테스트|qa|검증/.test(n)) return 'qa_testing';
  if (/배포|호스팅|deploy/.test(n)) return 'deployment';
  if (/기획|ux|ui.*설계/.test(n)) return 'planning_ux';
  if (/유지보수/.test(n)) return 'maintenance';
  return 'other_' + (name || '').slice(0, 20);
}

function quantile(arr, q) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function stats(arr) {
  if (!arr.length) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: Math.round(sum / arr.length),
    median: Math.round(quantile(arr, 0.5)),
    p25: Math.round(quantile(arr, 0.25)),
    p75: Math.round(quantile(arr, 0.75)),
  };
}

async function main() {
  // 예외 제외하고 모든 항목 가져오기
  const items = await prisma.referenceQuoteItem.findMany({
    where: { refQuote: { isException: false } },
    include: { refQuote: { select: { projectName: true, quoteDate: true, category: true } } },
    orderBy: [{ refQuote: { quoteDate: 'desc' } }, { sortOrder: 'asc' }],
  });

  console.log(`📊 분석 대상 항목: ${items.length}건 (예외 ReferenceQuote 제외)`);

  // 정규화 라벨로 그룹핑 + DB에 normalizedName 저장
  const groups = {};
  for (const item of items) {
    const norm = normalize(item.itemName);
    if (!groups[norm]) groups[norm] = { samples: [], rawNames: new Set() };
    groups[norm].samples.push({
      price: item.unitPrice,
      project: item.refQuote.projectName,
      date: item.refQuote.quoteDate,
      raw: item.itemName,
    });
    groups[norm].rawNames.add(item.itemName);

    // DB 저장
    await prisma.referenceQuoteItem.update({
      where: { id: item.id },
      data: { normalizedName: norm },
    });
  }

  // 통계 계산 + 출력
  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('📈 항목별 단가 baseline (n≥2 만, 단위: 원)');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('정규화 라벨                  |  n |   median  |    avg    |    p25    |    p75    |   range');
  console.log('-----------------------------|----|-----------|-----------|-----------|-----------|----------');

  const sorted = Object.entries(groups)
    .map(([k, v]) => ({ key: k, prices: v.samples.map(s => s.price), rawNames: v.rawNames, samples: v.samples }))
    .filter(g => g.prices.length >= 2)
    .sort((a, b) => b.prices.length - a.prices.length);

  for (const g of sorted) {
    const s = stats(g.prices);
    const fmt = (n) => n.toLocaleString().padStart(10);
    console.log(
      `${g.key.padEnd(28)} | ${String(s.n).padStart(2)} | ${fmt(s.median)}| ${fmt(s.avg)}| ${fmt(s.p25)}| ${fmt(s.p75)}| ${fmt(s.min)}~${fmt(s.max)}`
    );
  }

  // n=1 항목들
  console.log('\n📌 단일 데이터 항목 (n=1, 참고용)');
  const single = Object.entries(groups).filter(([_, v]) => v.samples.length === 1);
  for (const [k, v] of single) {
    console.log(`  ${k.padEnd(30)}: ₩${v.samples[0].price.toLocaleString()} (${v.samples[0].project.slice(0, 30)})`);
  }

  // 카테고리별 합계 baseline
  console.log('\n📊 프로젝트 합계 baseline (예외 제외)');
  const refs = await prisma.referenceQuote.findMany({
    where: { isException: false },
    select: { category: true, totalAmount: true, projectName: true, quoteDate: true, isFinal: true, revision: true },
    orderBy: { quoteDate: 'asc' },
  });
  const byCategory = {};
  for (const r of refs) {
    const c = r.category || '미분류';
    if (!byCategory[c]) byCategory[c] = [];
    byCategory[c].push(r.totalAmount);
  }
  console.log('카테고리       |  n  |   median   |    avg    |    p25    |    p75    |   range');
  console.log('---------------|-----|------------|-----------|-----------|-----------|----------');
  for (const [cat, prices] of Object.entries(byCategory)) {
    const s = stats(prices);
    console.log(
      `${cat.padEnd(14)} | ${String(s.n).padStart(2)} | ${s.median.toLocaleString().padStart(10)} | ${s.avg.toLocaleString().padStart(9)} | ${s.p25.toLocaleString().padStart(9)} | ${s.p75.toLocaleString().padStart(9)} | ${s.min.toLocaleString()}~${s.max.toLocaleString()}`
    );
  }

  // 시기별 trend
  console.log('\n📅 시기별 매출 trend (예외 제외)');
  const byMonth = {};
  for (const r of refs) {
    const m = r.quoteDate.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + r.totalAmount;
  }
  for (const [m, sum] of Object.entries(byMonth).sort()) {
    console.log(`  ${m}: ₩${sum.toLocaleString()}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
