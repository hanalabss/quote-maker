import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 모듈 마스터 데이터
  const modules = [
    {
      code: "UI_BASIC",
      name: "키오스크 UI 개발",
      category: "common",
      description: "키오스크 화면 UI 디자인 및 개발 (스플래시, 메인, 결과 화면)",
      basePrice: 200000,
      isAutoIncluded: false,
      sortOrder: 1,
    },
    {
      code: "PRINT_LOGIC",
      name: "인쇄/출력 로직",
      category: "common",
      description: "카드/사진/티켓 인쇄 출력 로직 개발",
      basePrice: 150000,
      isAutoIncluded: false,
      sortOrder: 2,
    },
    {
      code: "SDK_SMART51",
      name: "Printer SDK 연동",
      category: "common",
      description: "행사 프로그램에 맞는 Printer SDK 연동",
      basePrice: 100000,
      isAutoIncluded: false,
      sortOrder: 3,
    },
    {
      code: "CAM_PHOTO",
      name: "카메라/촬영 기능",
      category: "camera",
      description: "웹캠 연동 사진 촬영 및 미리보기 기능",
      basePrice: 150000,
      isAutoIncluded: false,
      sortOrder: 4,
    },
    {
      code: "QR_UPLOAD",
      name: "QR코드 업로드",
      category: "qr",
      description: "QR코드 스캔을 통한 이미지/데이터 업로드",
      basePrice: 150000,
      isAutoIncluded: false,
      sortOrder: 5,
    },
    {
      code: "TEXT_INPUT",
      name: "텍스트 입력 기능",
      category: "text",
      description: "이름, 닉네임 등 텍스트 입력 및 키보드 UI",
      basePrice: 150000,
      isAutoIncluded: false,
      sortOrder: 6,
    },
    {
      code: "SERVER_SYNC",
      name: "서버 연동/데이터 저장",
      category: "server",
      description: "서버 연동을 통한 실시간 데이터 저장 및 통계",
      basePrice: 500000,
      isAutoIncluded: false,
      sortOrder: 7,
    },
    {
      code: "AI_STYLE",
      name: "AI 화풍변환",
      category: "ai",
      description: "자사 서버를 통한 AI 화풍변환. 장당 인쇄 또는 행사 기간별로 과금될 수 있습니다",
      basePrice: 0,
      isAutoIncluded: false,
      sortOrder: 8,
    },
    {
      code: "AI_FEE",
      name: "외부 API 사용",
      category: "ai",
      description: "인쇄 장수 또는 행사 날짜별로 추가금이 과금될 수 있습니다",
      basePrice: 500000,
      isAutoIncluded: false,
      sortOrder: 9,
    },
    {
      code: "TEST_QA",
      name: "테스트 및 유지보수",
      category: "common",
      description: "개발 완료 후 테스트, 현장 리허설 및 행사 당일 유지보수",
      basePrice: 100000,
      isAutoIncluded: true,
      sortOrder: 10,
    },
    {
      code: "SELECT_PRINT",
      name: "선택 인쇄 기능",
      category: "common",
      description: "업로드 이미지 선택 출력",
      basePrice: 150000,
      isAutoIncluded: false,
      sortOrder: 11,
    },
    {
      code: "KSNET_PAY",
      name: "KSNET 결제 시스템 연동",
      category: "payment",
      description: "KSNET 실결제 연동, 카드 결제 테스트 및 검증, 실결제 환경 적용",
      basePrice: 300000,
      isAutoIncluded: false,
      sortOrder: 12,
    },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { code: mod.code },
      update: mod,
      create: mod,
    });
  }

  console.log(`✅ ${modules.length}개 모듈 시드 완료`);

  // 기본 사용자
  const users = [
    { loginId: "admin", password: "admin", name: "관리자", email: "dev@hanapf.kr", role: "dev", team: "개발팀", position: null },
    { loginId: "jdy", password: "1234", name: "정두용", email: "jdy@hanapf.kr", role: "sales", team: "사업팀", position: "팀장" },
    { loginId: "cmb", password: "1234", name: "채민병", email: "cmb@hanapf.kr", role: "sales", team: "사업팀", position: "대리" },
    { loginId: "kjn", password: "1234", name: "김정남", email: "kjn@hanapf.kr", role: "sales", team: "사업팀", position: "이사" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }

  console.log(`✅ ${users.length}명 사용자 시드 완료`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
