// 삼전사옥 내방객관리시스템 견적 업데이트
// - 11항목(285만) → 3항목(200만/VAT 220만)
// - 권한 관리 제외(별도 업체) 반영
// - 에스원 DB to DB 명시
// - 추가 기능 별도 견적 강조
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const QUOTE_ID = 'cmotqdwec00018jub6ugjemxy';

async function main() {
  const items = [
    {
      name: '웹 시스템 개발 일체',
      desc: '내방신청·QR·키오스크·담당자 승인 4화면 (반응형 웹) + 백엔드 API + QR 발급/만료',
      unitPrice: 1650000,
      isRequired: true,
    },
    {
      name: '외부 시스템 연동',
      desc: '에스원 출입통제 DB-to-DB + 휴대폰 본인인증 + 알림 발송(카카오 알림톡 또는 SMS)',
      unitPrice: 600000,
      isRequired: true,
    },
    {
      name: '통합 테스트 / QA',
      desc: '통합 시나리오 검증 + PC·모바일·키오스크 디바이스 검증',
      unitPrice: 250000,
      isRequired: true,
    },
  ];

  const subtotal = items.reduce((s, x) => s + x.unitPrice, 0);
  const vat = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + vat;

  const notes = [
    '※ 권한 관리(방문 층 권한 등)는 본 견적 범위에서 제외됩니다 (별도 업체 진행)',
    '※ 에스원 출입통제 시스템 연동은 DB-to-DB 직접 연결 방식 기준입니다 (스키마 협의 후 변동 가능)',
    '※ 알림 발송은 카카오 알림톡 또는 SMS 중 1종 구현 기준입니다 (채널 선택은 협의 후 확정)',
    '※ 본 견적에 명시되지 않은 추가 개발, 기능 변경, 어드민/통계/이력 리포트, SSO 등은 별도 견적입니다',
    '※ 휴대폰 본인인증·알림 발송 운영비, WAS 서버, 카카오 발신프로필 등록 비용 및 일정은 별도입니다',
  ].join('\n');

  // 기존 items 삭제 → 새 items insert (트랜잭션)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: QUOTE_ID } });
    return tx.quote.update({
      where: { id: QUOTE_ID },
      data: {
        subtotal,
        vat,
        totalAmount,
        notes,
        items: {
          create: items.map((it, i) => ({
            moduleId: null,
            sortOrder: i + 1,
            itemName: it.name,
            description: it.desc,
            unitPrice: it.unitPrice,
            quantity: 1,
            amount: it.unitPrice,
            isRequired: it.isRequired ?? true,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  console.log('업데이트 완료');
  console.log('견적번호 :', updated.quoteNumber);
  console.log('요청자   :', updated.requesterName);
  console.log('공급가   :', subtotal.toLocaleString(), '원');
  console.log('VAT      :', vat.toLocaleString(), '원');
  console.log('합계     :', totalAmount.toLocaleString(), '원');
  console.log('항목수   :', updated.items.length);
  for (const it of updated.items) {
    console.log(` ${it.sortOrder}. ${it.itemName}  ${it.unitPrice.toLocaleString()}원`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
