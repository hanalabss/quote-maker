// 행사용 추가 기능 모듈 upsert — 지금까지 견적에서 직접 작성(커스텀)했던 항목을 모듈로 정리 (2026-11-01)
// 사용법: node scripts/upsert-event-modules.js [--activate]
//  - 기본: isActive:false로 등록 (사업팀 안내 문구·분류 화면 배포 전 운영 요청 폼에 노출 방지)
//  - --activate: isActive:true로 전환 (배포 후 실행)
// 가격 근거(렌탈 기준가)는 각 항목 주석의 실제 견적 금액. name/description은 고객 견적서에 찍히는 문구.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODULES = [
  // 라피엘 OX퀴즈 100K, 동국제약 설문 결과 150K, 엠아이웍스 피부고민 분기 130K
  { code: 'QUIZ_SURVEY', name: '퀴즈/설문 결과 산출 로직', description: '문항 응답에 따른 화면 분기 및 결과(유형·점수·추천) 산출', basePrice: 150000, category: 'content', sortOrder: 31 },
  // CJ 운세 랜덤 150K, 현대캐피탈 좌석 추첨 로직 150K
  { code: 'RANDOM_DRAW', name: '랜덤 결과/추첨 로직', description: '결과 문구·경품·좌석 등 랜덤 추첨(중복 방지) 및 추첨 연출', basePrice: 150000, category: 'content', sortOrder: 32 },
  // 라피엘 이상형 월드컵 토너먼트 100K
  { code: 'MINI_GAME', name: '선택형 게임 로직', description: '이상형 월드컵 등 토너먼트·선택형 게임 진행 및 최종 결과 처리', basePrice: 100000, category: 'content', sortOrder: 33 },
  // 오오비컴퍼니 한/영/중/일 150K
  { code: 'MULTI_LANG', name: '다국어 지원', description: '언어 선택 버튼 및 화면 안내 문구 언어 전환 (언어별 화면 디자인 미제공 시)', basePrice: 150000, category: 'content', sortOrder: 34 },
  // 라피엘 헤드셋 BGM 150K
  { code: 'AUDIO_BGM', name: 'BGM/음성 출력', description: '배경음악·효과음·안내 음성 재생, 오디오 채널 분리 출력', basePrice: 150000, category: 'content', sortOrder: 35 },
  // 인천소방 얼굴합성 250K (키오스크 PC 처리, AI 서버 비용 없음)
  { code: 'FACE_SWAP', name: '얼굴 합성', description: '촬영 사진의 얼굴을 자동 인식해 지정 시안에 합성 (키오스크 내 처리, 서버 비용 없음)', basePrice: 250000, category: 'camera', sortOrder: 36 },
  // 삼성 달수 실시간 AR 합성 250K
  { code: 'AR_LIVE', name: '실시간 AR 캐릭터 합성', description: '실시간 카메라 영상에 캐릭터 합성 및 모션, 촬영·인쇄 결과물 반영', basePrice: 250000, category: 'camera', sortOrder: 37 },
  // 워크인프로그래스·이알플러스 모바일 저장(QR 전송) +150K
  { code: 'MOBILE_SAVE', name: '모바일 결과 전송 (QR)', description: '결과 이미지를 QR코드로 방문객 휴대폰에 전달 (일정 기간 후 자동 삭제)', basePrice: 150000, category: 'delivery', sortOrder: 38 },
  // 소원콘텐츠 번호 입력 + SMS 발송 260K
  { code: 'SMS_SEND', name: 'SMS 발송 연동', description: '휴대폰 번호 입력(수집 동의 포함) 및 결과·영수증 문자 발송', basePrice: 250000, category: 'delivery', sortOrder: 39 },
  // SKT T1 NFC 태그 음원 재생 코어 200K, 카자니아 RFID 팔찌 식별 200K
  { code: 'TAG_TRIGGER', name: 'RFID/NFC 태그 인식', description: '카드·팔찌 태그 인식 시 지정 동작 실행 (음원 재생, 고객 식별 등)', basePrice: 200000, category: 'link', sortOrder: 40 },
  // 현대캐피탈 명단 엑셀 옵션 +100K
  { code: 'LIST_UPLOAD', name: '참가자 명단 엑셀 연동', description: '사전 명단 엑셀 등록 및 현장 조회·확인 처리', basePrice: 100000, category: 'link', sortOrder: 41 },
  // 부산모빌리티쇼 실시간 모니터링 대시보드 100K
  { code: 'LIVE_DASHBOARD', name: '실시간 현황 대시보드', description: '참여 인원·진행 현황을 운영자가 웹에서 실시간 확인', basePrice: 100000, category: 'link', sortOrder: 42 },
  // 현대캐피탈 기기 간 공유 150K, 부산 서버/DB 200K (6대 이상 대형은 개발팀 조정)
  { code: 'MULTI_DEVICE', name: '멀티 키오스크 데이터 동기화', description: '여러 대 키오스크 간 데이터 공유·중복 방지 및 결과 저장', basePrice: 200000, category: 'link', sortOrder: 43 },
];

const activate = process.argv.includes('--activate');

(async () => {
  for (const m of MODULES) {
    const data = { ...m, isAutoIncluded: false, isActive: activate };
    await prisma.module.upsert({ where: { code: m.code }, update: data, create: data });
    console.log(`${activate ? '활성화' : '등록(비활성)'}: ${m.code} ${m.name} ${m.basePrice.toLocaleString()}`);
  }
  console.log(`\n행사 기능 모듈 ${MODULES.length}개 (isActive: ${activate})`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FAIL:', e);
  await prisma.$disconnect();
  process.exit(1);
});
