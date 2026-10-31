const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Usage: node inspect-quote.js <quoteId> [<quoteId2> ...]');
  process.exit(1);
}

(async () => {
  for (const id of ids) {
    const q = await prisma.quote.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        comments: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!q) {
      console.log(`(not found) ${id}`);
      continue;
    }
    console.log('===============================================');
    console.log(`${q.quoteNumber}  [${q.status}]  type=${q.type}`);
    console.log(`행사명: ${q.eventName}`);
    console.log(`행사일: ${q.eventDate?.toString?.() ?? '-'} ~ ${q.eventEndDate?.toString?.() ?? '-'}`);
    console.log(`납기: ${q.deadline?.toString?.() ?? '-'}`);
    console.log(`장소: ${q.venue ?? '-'}`);
    console.log(`방문객: ${q.expectedVisitors ?? '-'}`);
    console.log(`요청자: ${q.requesterName ?? '-'}  ${q.requesterContact ?? ''}  ${q.requesterEmail ?? ''}`);
    console.log(`화면: device=${q.screenDevice ?? '-'}  res=${q.screenResolution ?? '-'}  comp=${q.screenComposition ?? '-'}`);
    console.log(`인쇄: printer=${q.printerType ?? '-'}  size=${q.printSize ?? '-'}`);
    console.log(`네트워크: ${q.networkType ?? '-'}  KSNET: ${q.ksnetMerchantId ?? '-'}`);
    console.log(`합계: subtotal=${q.subtotal?.toLocaleString() ?? '-'}  VAT=${q.vat?.toLocaleString() ?? '-'}  total=${q.totalAmount?.toLocaleString() ?? '-'}`);
    if (q.notes) {
      console.log('--- 메모(notes) ---');
      console.log(q.notes);
    }
    if (q.reviewNote) {
      console.log('--- 검토 메모(reviewNote) ---');
      console.log(q.reviewNote);
    }
    console.log('--- 항목 ---');
    for (const it of q.items) {
      console.log(`  [${it.sortOrder}] ${it.itemName}  단가=${it.unitPrice.toLocaleString()}  수량=${it.quantity}  금액=${it.amount.toLocaleString()}  ${it.isRequired ? '필수' : '옵션'}`);
      if (it.description) console.log(`        설명: ${it.description}`);
      if (it.note) console.log(`        비고: ${it.note}`);
    }
    const atts = await prisma.attachment?.findMany?.({ where: { quoteId: q.id } }).catch(() => []);
    if (atts && atts.length) {
      console.log('--- 첨부 ---');
      for (const a of atts) console.log(`  ${a.fileName ?? a.name}  (${a.fileSize ?? a.size}B)`);
    }
    if (q.comments?.length) {
      console.log('--- 댓글 ---');
      for (const c of q.comments) {
        console.log(`  [${c.user?.name ?? c.user?.email ?? '-'}] ${c.createdAt.toISOString()}`);
        console.log(`    ${c.content.replace(/\n/g, '\n    ')}`);
      }
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
