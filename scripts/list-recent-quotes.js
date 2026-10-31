const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const since = new Date();
  since.setDate(since.getDate() - 5);

  const quotes = await prisma.quote.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      type: true,
      eventName: true,
      requesterName: true,
      requesterEmail: true,
      totalAmount: true,
      createdAt: true,
      reviewedById: true,
      reviewNote: true,
      updatedAt: true,
      requesterContact: true,
    },
  });

  for (const q of quotes) {
    console.log('---');
    console.log(`${q.quoteNumber}  [${q.status}]  ${q.type}`);
    console.log(`  생성: ${q.createdAt.toISOString()}`);
    console.log(`  행사: ${q.eventName}`);
    console.log(`  요청자: ${q.requesterName ?? '-'}  (${q.requesterEmail ?? '-'})`);
    console.log(`  합계: ${q.totalAmount?.toLocaleString() ?? '-'}원`);
    console.log(`  검토자: ${q.reviewedById ?? '-'}  업데이트: ${q.updatedAt.toISOString()}`);
    console.log(`  요청자연락처: ${q.requesterContact ?? '-'}`);
    if (q.reviewNote) console.log(`  메모: ${q.reviewNote.slice(0, 120).replace(/\n/g, ' / ')}`);
    console.log(`  URL: https://quote-maker-alpha.vercel.app/dashboard/quotes/${q.id}`);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
