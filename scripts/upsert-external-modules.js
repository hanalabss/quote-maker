// 외주(external) 모듈 기본 틀 upsert — prisma/seed.ts의 external 모듈과 동일 데이터
// 사용법: node scripts/upsert-external-modules.js [--activate]
//  - 기본: isActive:false로 등록 (category 필터 배포 전 요청 폼 오염 방지)
//  - --activate: isActive:true로 전환 (배포 후 실행)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODULES = [
  { code: 'EXT_PLANNING', name: '기획 / 화면 설계', description: '화면 설계, 연동 데이터 스펙 정의, 리포트 항목 및 출력 구조 설계', basePrice: 500000, sortOrder: 101 },
  { code: 'EXT_WEB_ADMIN', name: '관리자 화면 개발', description: '관리자 조회·통계 화면 개발 (검색/필터, 대시보드, 엑셀 리포트)', basePrice: 500000, sortOrder: 102 },
  { code: 'EXT_WEB_USER', name: '사용자 웹/신청 화면 개발', description: '신청·조회 등 사용자 대면 화면 개발 (반응형 웹)', basePrice: 1000000, sortOrder: 103 },
  { code: 'EXT_API', name: '백엔드 API 개발', description: '수신 API 엔드포인트, 비즈니스 로직, DB 스키마 설계', basePrice: 1000000, sortOrder: 104 },
  { code: 'EXT_LINK', name: '외부 시스템 연동', description: 'ERP·출입통제(S1) 등 DB-to-DB 또는 API 연동, 연동 테스트 및 기술 협의', basePrice: 1000000, sortOrder: 105 },
  { code: 'EXT_AUTH', name: '인증 연동 (SSO/본인인증)', description: 'OIDC/SSO 표준 인증 연동, 휴대폰 본인인증', basePrice: 500000, sortOrder: 106 },
  { code: 'EXT_QR', name: 'QR 발급/인증 로직', description: 'QR 토큰 생성 및 암호화, 방문/출입 인증 처리', basePrice: 1500000, sortOrder: 107 },
  { code: 'EXT_NOTIFY', name: '알림 발송 (SMS/카카오)', description: 'SMS/MMS/카카오 알림톡 발송 연동 및 발송 정책 적용', basePrice: 1500000, sortOrder: 108 },
  { code: 'EXT_DEPLOY', name: '서버 구축 및 배포', description: '서버 세팅, 빌드 배포, 운영 환경 구성', basePrice: 1000000, sortOrder: 109 },
  { code: 'EXT_QA', name: '통합 테스트 / QA', description: '통합 시나리오 검증, PC·모바일·키오스크 디바이스 검증', basePrice: 250000, sortOrder: 110 },
];

const activate = process.argv.includes('--activate');

(async () => {
  for (const m of MODULES) {
    const data = { ...m, category: 'external', isAutoIncluded: false, isActive: activate };
    await prisma.module.upsert({ where: { code: m.code }, update: data, create: data });
    console.log(`${activate ? '활성화' : '등록(비활성)'}: ${m.code} ${m.name} ${m.basePrice.toLocaleString()}`);
  }
  const count = await prisma.module.count({ where: { category: 'external' } });
  console.log(`\n외주 모듈 총 ${count}개 (isActive: ${activate})`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FAIL:', e);
  await prisma.$disconnect();
  process.exit(1);
});
