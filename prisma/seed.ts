import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
      code: "PRINT_SDK",
      name: "인쇄/출력 및 Printer SDK 연동",
      category: "common",
      description: "카드/사진/티켓 인쇄 출력 로직 및 Printer SDK 연동 (단순 insert/out 포함)",
      basePrice: 100000,
      isAutoIncluded: false,
      sortOrder: 11,
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
    // SERVER_SYNC 비활성화 - 무료 서비스(DB 직접 연결 로그)로 대체
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
      name: "이미지 선택/인쇄 기능",
      category: "common",
      description: "업로드 이미지 선택 및 출력",
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
    // ─── 외주(external) 모듈: 협력사 경유 개발 견적용 기본 틀 ───
    // 사업팀 요청 폼에는 노출되지 않음 (category: external 필터).
    // 기본단가는 실제 외주 견적(MAP·삼전사옥·인하대) 실적 기반 참고값 — 프로젝트마다 조정.
    {
      code: "EXT_PLANNING",
      name: "기획 / 화면 설계",
      category: "external",
      description: "화면 설계, 연동 데이터 스펙 정의, 리포트 항목 및 출력 구조 설계",
      basePrice: 500000,
      isAutoIncluded: false,
      sortOrder: 101,
    },
    {
      code: "EXT_WEB_ADMIN",
      name: "관리자 화면 개발",
      category: "external",
      description: "관리자 조회·통계 화면 개발 (검색/필터, 대시보드, 엑셀 리포트)",
      basePrice: 500000,
      isAutoIncluded: false,
      sortOrder: 102,
    },
    {
      code: "EXT_WEB_USER",
      name: "사용자 웹/신청 화면 개발",
      category: "external",
      description: "신청·조회 등 사용자 대면 화면 개발 (반응형 웹)",
      basePrice: 1000000,
      isAutoIncluded: false,
      sortOrder: 103,
    },
    {
      code: "EXT_API",
      name: "백엔드 API 개발",
      category: "external",
      description: "수신 API 엔드포인트, 비즈니스 로직, DB 스키마 설계",
      basePrice: 1000000,
      isAutoIncluded: false,
      sortOrder: 104,
    },
    {
      code: "EXT_LINK",
      name: "외부 시스템 연동",
      category: "external",
      description: "ERP·출입통제(S1) 등 DB-to-DB 또는 API 연동, 연동 테스트 및 기술 협의",
      basePrice: 1000000,
      isAutoIncluded: false,
      sortOrder: 105,
    },
    {
      code: "EXT_AUTH",
      name: "인증 연동 (SSO/본인인증)",
      category: "external",
      description: "OIDC/SSO 표준 인증 연동, 휴대폰 본인인증",
      basePrice: 500000,
      isAutoIncluded: false,
      sortOrder: 106,
    },
    {
      code: "EXT_QR",
      name: "QR 발급/인증 로직",
      category: "external",
      description: "QR 토큰 생성 및 암호화, 방문/출입 인증 처리",
      basePrice: 1500000,
      isAutoIncluded: false,
      sortOrder: 107,
    },
    {
      code: "EXT_NOTIFY",
      name: "알림 발송 (SMS/카카오)",
      category: "external",
      description: "SMS/MMS/카카오 알림톡 발송 연동 및 발송 정책 적용",
      basePrice: 1500000,
      isAutoIncluded: false,
      sortOrder: 108,
    },
    {
      code: "EXT_DEPLOY",
      name: "서버 구축 및 배포",
      category: "external",
      description: "서버 세팅, 빌드 배포, 운영 환경 구성",
      basePrice: 1000000,
      isAutoIncluded: false,
      sortOrder: 109,
    },
    {
      code: "EXT_QA",
      name: "통합 테스트 / QA",
      category: "external",
      description: "통합 시나리오 검증, PC·모바일·키오스크 디바이스 검증",
      basePrice: 250000,
      isAutoIncluded: false,
      sortOrder: 110,
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

  // 기본 사용자 (비밀번호 bcrypt 해싱)
  const usersRaw = [
    { loginId: "admin", password: "admin", name: "관리자", email: "dev@hanapf.kr", role: "dev", team: "개발팀", position: null },
    { loginId: "jdy", password: "1234", name: "정두용", email: "jdy@hanapf.kr", role: "sales", team: "사업팀", position: "팀장" },
    { loginId: "cmb", password: "1234", name: "채민병", email: "cmb@hanapf.kr", role: "sales", team: "사업팀", position: "대리" },
    { loginId: "kjn", password: "1234", name: "김정남", email: "kjn@hanapf.kr", role: "sales", team: "사업팀", position: "이사" },
    { loginId: "dev1", password: "1234", name: "개발직원", email: "dev1@hanapf.kr", role: "dev_staff", team: "개발팀", position: "사원" },
  ];

  for (const raw of usersRaw) {
    const hashedPassword = await bcrypt.hash(raw.password, 12);
    const user = { ...raw, password: hashedPassword };
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }

  console.log(`✅ ${usersRaw.length}명 사용자 시드 완료`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
