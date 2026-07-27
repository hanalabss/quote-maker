// 외주 견적 등록 공용 함수 — 필수 필드 누락 시 throw (조용히 틀린 월에 잡히는 사고 방지)
// 사용 예: scripts/register-map-visitor-quote.js 참조
const ADMIN_USER_ID = 'cmlfx3l4j0000ipl0yp8jv6c9'; // 관리자(dev)

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   quoteDate: string,        // 견적서 작성일 YYYY-MM-DD → 견적번호 QT-YYYYMMDD-XXX
 *   eventName: string,        // 프로젝트명
 *   requesterName: string,    // 의뢰 경로 (협력사/담당자)
 *   confirmedDate: string,    // 계약/착수일 YYYY-MM-DD → 매출 인식 월 (status=lost면 금지)
 *   devDeadline: string,      // 납기/가동 목표 YYYY-MM-DD (status=lost면 금지)
 *   items: { itemName: string, description?: string, unitPrice: number, quantity?: number }[],
 *   expectedTotal: number,    // 원본 견적서의 VAT 포함 합계 (검증용, 불일치 시 throw)
 *   venue?: string,
 *   notes?: string,
 *   status?: string,          // 'confirmed'(기본) | 'lost'(견적만 내고 미진행)
 *   lostReason?: string,      // status=lost면 필수. 접두어 컨벤션: 가격|일정|고객취소|무응답|기타 — 상세
 * }} input
 */
async function registerExternalQuote(prisma, input) {
  const status = input.status || 'confirmed';
  if (!['confirmed', 'lost'].includes(status)) {
    throw new Error(`허용되지 않는 status: ${status} (confirmed|lost만 가능)`);
  }

  const required = ['quoteDate', 'eventName', 'requesterName', 'items', 'expectedTotal'];
  if (status !== 'lost') required.push('confirmedDate', 'devDeadline');
  for (const key of required) {
    const v = input[key];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0)) {
      throw new Error(`필수 필드 누락: ${key}`);
    }
  }
  if (status === 'lost') {
    if (!input.lostReason || !input.lostReason.trim()) {
      throw new Error('필수 필드 누락: lostReason (lost 등록 시 필수)');
    }
    // 미진행 건에 확정 날짜가 남으면 lost→confirmed 부활 시 옛 날짜가 월귀속을 조용히 틀리게 함 — 원천 차단
    if (input.confirmedDate || input.devDeadline) {
      throw new Error('lost 견적에는 confirmedDate/devDeadline을 지정할 수 없습니다');
    }
    if (!/^(가격|일정|고객취소|무응답|기타)\s*[—-]/.test(input.lostReason)) {
      console.warn('[경고] lostReason 접두어 컨벤션 미준수: "가격|일정|고객취소|무응답|기타 — 상세" 형식 권장');
    }
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const dateKeys = status === 'lost' ? ['quoteDate'] : ['quoteDate', 'confirmedDate', 'devDeadline'];
  for (const key of dateKeys) {
    if (!dateRe.test(input[key])) throw new Error(`${key}는 YYYY-MM-DD 형식이어야 합니다: ${input[key]}`);
  }

  const items = input.items.map((it, idx) => {
    if (!it.itemName || !it.unitPrice) throw new Error(`items[${idx}]: itemName/unitPrice 필수`);
    const quantity = it.quantity ?? 1;
    return {
      itemName: it.itemName,
      description: it.description || null,
      unitPrice: it.unitPrice,
      quantity,
      amount: it.unitPrice * quantity,
      isRequired: true,
      sortOrder: idx + 1,
    };
  });

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const vat = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + vat;
  if (totalAmount !== input.expectedTotal) {
    throw new Error(`합계 불일치: 계산 ${totalAmount} !== 원본 ${input.expectedTotal} (VAT 포함)`);
  }

  const prefix = `QT-${input.quoteDate.replace(/-/g, '')}`;
  const last = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: 'desc' },
  });
  const seq = last ? parseInt(last.quoteNumber.split('-')[2], 10) + 1 : 1;
  const quoteNumber = `${prefix}-${String(seq).padStart(3, '0')}`;

  return prisma.quote.create({
    data: {
      quoteNumber,
      status,
      type: 'sale',
      isExternal: true,
      eventName: input.eventName,
      venue: input.venue || null,
      requesterName: input.requesterName,
      confirmedAt: status === 'lost' ? null : new Date(`${input.confirmedDate}T00:00:00+09:00`),
      confirmedDate: status === 'lost' ? null : input.confirmedDate,
      devDeadline: status === 'lost' ? null : input.devDeadline,
      lostReason: status === 'lost' ? input.lostReason.trim() : null,
      notes: input.notes || null,
      subtotal,
      vat,
      totalAmount,
      createdById: ADMIN_USER_ID,
      reviewedById: ADMIN_USER_ID,
      items: { create: items },
    },
    include: { items: true },
  });
}

module.exports = { registerExternalQuote, ADMIN_USER_ID };
