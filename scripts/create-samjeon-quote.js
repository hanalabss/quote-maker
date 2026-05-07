// 삼전사옥 내방객관리시스템 견적 등록 (모듈 매핑 없는 자유 항목)
// 일회성 스크립트. 외부 docx 요구사항 → quote-maker DB 등록.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateQuoteNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `QT-${dateStr}`;
  const last = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: 'desc' },
  });
  let seq = 1;
  if (last) seq = parseInt(last.quoteNumber.split('-')[2], 10) + 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

async function main() {
  // 항목 (사용자 승인 가격대)
  const items = [
    { name: '내방 신청 반응형 웹', desc: 'PC/모바일 신청 폼, 휴대폰 본인인증, 담당자 알림', unitPrice: 350000 },
    { name: '담당자 승인 웹',       desc: '사번/링크 인증, 승인·거부 처리, 층 권한 입력',     unitPrice: 300000 },
    { name: 'QR 스캔 모바일 웹',    desc: 'QR 스캔 진입 후 신청 폼 (반응형)',                  unitPrice: 150000 },
    { name: '키오스크 등록 화면',   desc: '현장 키오스크용 신청 웹 화면',                     unitPrice: 200000 },
    { name: '백엔드 API',           desc: '신청/승인/QR 발급/만료 처리 로직',                 unitPrice: 500000 },
    { name: '에스원 출입통제 DB 연동', desc: 'DB 연동 방식 협의 후 조정 가능',               unitPrice: 500000 },
    { name: '카카오/SMS 알림 연동', desc: '담당자 알림톡 또는 SMS 발송',                       unitPrice: 200000 },
    { name: '휴대폰 본인인증 연동', desc: 'PASS/통신사 본인인증 API',                          unitPrice: 200000 },
    { name: 'QR코드 발급/만료',     desc: '시간 기반 QR 발급 및 방문일 종료 시 차단',         unitPrice: 150000 },
    { name: '층 권한 관리',         desc: '방문 가능 층 권한 (게이트 없음)',                  unitPrice: 100000 },
    { name: '통합 테스트 / QA',     desc: '시나리오 검증 및 통합 테스트',                      unitPrice: 200000 },
  ];

  const subtotal = items.reduce((s, x) => s + x.unitPrice, 0);
  const vat = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + vat;

  // 관리자 계정을 createdBy로 (사용자가 추후 본인 계정으로 변경 가능)
  const admin = await prisma.user.findFirst({ where: { loginId: 'admin' } });
  if (!admin) throw new Error('관리자 계정 없음');

  const quoteNumber = await generateQuoteNumber();

  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      status: 'pending',
      type: 'sale',
      createdById: admin.id,
      eventName: '삼전사옥 내방객관리시스템',
      requesterName: '미정 (추후 입력)',
      notes: [
        '※ 외부 요청 견적 (출처: 내방객시스템 기능_260504.docx)',
        '※ 별도 비용: 휴대폰 본인인증 건당 사용료, 카카오 알림톡/SMS 발송료, WAS 서버(별도 구축 시)',
        '※ 에스원 출입통제 DB 연동 단가는 연동 규격 협의 후 조정 가능',
        '※ 개발기 여유 충분 (내년 진행), 최대한 간단·저렴 방향으로 산출',
      ].join('\n'),
      subtotal,
      vat,
      totalAmount,
      items: {
        create: items.map((it, i) => ({
          moduleId: null,
          sortOrder: i + 1,
          itemName: it.name,
          description: it.desc,
          unitPrice: it.unitPrice,
          quantity: 1,
          amount: it.unitPrice,
        })),
      },
    },
    include: { items: true },
  });

  console.log('\n등록 완료');
  console.log('견적번호 :', quote.quoteNumber);
  console.log('견적ID   :', quote.id);
  console.log('공급가   :', subtotal.toLocaleString(), '원');
  console.log('VAT      :', vat.toLocaleString(), '원');
  console.log('합계     :', totalAmount.toLocaleString(), '원');
  console.log('항목수   :', quote.items.length);
  console.log('\nUI: https://quote-maker-alpha.vercel.app/dashboard/quotes/' + quote.id);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
