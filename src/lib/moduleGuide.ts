// 사업팀 요청 화면용 기능 안내 (고객 언어)
// 모듈 name/description은 고객에게 나가는 견적서 항목명이라 그대로 두고, 요청 화면에서만 이 문구를 보여준다.
// 여기 없는 모듈(새로 추가된 모듈)은 기존 name/description으로 "기타" 묶음에 표시된다.

export type GuideGroup = "photo" | "play" | "deliver" | "link" | "base";

// 요청 화면 기능 묶음 — 방문객이 하는 일 순서(찍고 → 참여하고 → 받아 가고) + 운영
export const GUIDE_GROUPS: { key: GuideGroup | "etc"; label: string; hint: string }[] = [
  { key: "photo", label: "사진·촬영", hint: "방문객 사진을 찍거나 받아서 꾸미는 기능" },
  { key: "play", label: "참여·입력", hint: "방문객이 화면에서 입력하거나 참여하는 기능" },
  { key: "deliver", label: "결과 받아 가기", hint: "결과를 인쇄하거나 휴대폰으로 전달하는 기능" },
  { key: "link", label: "결제·연동·운영", hint: "결제, 카드 태그, 명단, 여러 대 운영 등" },
  { key: "base", label: "기본 포함", hint: "화면·테스트 등 대부분의 행사에 들어가는 항목" },
  { key: "etc", label: "기타", hint: "" },
];

export interface ModuleGuide {
  group: GuideGroup;
  title: string; // 사업팀이 보는 이름
  when: string; // 이럴 때 고르세요
  example?: string; // 행사 예시
  note?: string; // 함께 알아둘 점 (자동 선택, 추가 비용 등)
}

export const MODULE_GUIDE: Record<string, ModuleGuide> = {
  // ── 기본 ──
  UI_BASIC: {
    group: "base",
    title: "키오스크 화면 만들기",
    when: "방문객이 보는 시작·안내·완료 화면 전체입니다. 거의 모든 행사에 필요합니다.",
    note: "화면이 있는 기능을 고르면 자동으로 함께 선택됩니다.",
  },
  TEST_QA: {
    group: "base",
    title: "테스트·행사 당일 원격 지원",
    when: "개발 후 테스트와 행사 당일 원격 지원입니다. 모든 견적에 자동으로 들어갑니다.",
  },

  // ── 사진·촬영 ──
  CAM_PHOTO: {
    group: "photo",
    title: "키오스크에서 사진 찍기",
    when: "방문객이 키오스크 앞에서 바로 사진을 찍어야 할 때",
    example: "포토카드, 즉석 사진 인화",
  },
  QR_UPLOAD: {
    group: "photo",
    title: "휴대폰 사진 올리기",
    when: "방문객이 QR코드를 찍어 자기 휴대폰 사진을 키오스크로 보낼 때",
    example: "미리 찍어 둔 셀카로 카드 만들기",
  },
  SELECT_PRINT: {
    group: "photo",
    title: "인쇄할 카드 디자인 고르기",
    when: "방문객이 키오스크 화면에서 여러 카드(사진) 디자인 중 하나를 골라 그 디자인으로 인쇄할 때",
    example: "포토카드 디자인 4종(사진 뒤 배경·테두리가 다름)을 화면에 보여주고 방문객이 1개 선택",
    note: "디자인이 1종뿐이면 고르지 않습니다. 디자인 파일은 고객사에서 받습니다.",
  },
  FACE_SWAP: {
    group: "photo",
    title: "얼굴 합성",
    when: "찍은 사진에서 얼굴만 따서 정해진 그림(소방관·우주인 등)에 자연스럽게 넣을 때",
    example: "소방관 제복 그림에 방문객 얼굴 합성",
    note: "키오스크 안에서 처리해 서버 비용이 없습니다. 합성할 그림(시안)은 고객사에서 받습니다.",
  },
  AR_LIVE: {
    group: "photo",
    title: "화면 속 캐릭터와 함께 찍기 (AR)",
    when: "카메라 화면에 캐릭터가 실시간으로 나타나 움직이고, 그 상태로 사진을 찍을 때",
    example: "브랜드 캐릭터가 옆에서 헤엄치는 화면으로 촬영",
    note: "캐릭터 원본 파일은 고객사에서 받습니다.",
  },
  // AI 두 항목은 둘 중 하나 (requestItems.AI_EXCLUSIVE)
  AI_STYLE: {
    group: "photo",
    title: "AI 그림체 변환 (하나플랫폼 AI 서버)",
    when: "찍은 사진을 웹툰·유화 같은 그림체로 바꿔 인쇄할 때. 하나플랫폼 AI 서버로 처리합니다.",
    note: "행사 일수만큼 서버 사용료가 붙어 금액은 개발팀과 협의합니다. '외부 AI 서비스 사용료'와는 둘 중 하나만 고릅니다.",
  },
  AI_FEE: {
    group: "photo",
    title: "외부 AI 서비스 사용료",
    when: "하나플랫폼 서버가 아닌 다른 회사의 유료 AI 서비스를 키오스크에 연결해 쓸 때",
    note: "인쇄 장수나 행사 일수에 따라 추가 비용이 생길 수 있습니다. 'AI 그림체 변환'과는 둘 중 하나만 고릅니다.",
  },

  // ── 참여·입력 ──
  TEXT_INPUT: {
    group: "play",
    title: "이름·문구 입력",
    when: "방문객이 화면 키보드로 이름·소속·메시지 등을 직접 입력할 때",
    example: "사원증에 이름 넣기, 응원 메시지 카드",
  },
  QUIZ_SURVEY: {
    group: "play",
    title: "퀴즈·설문으로 결과 보여주기",
    when: "방문객이 질문에 답하면 답에 따라 다른 결과(유형·점수·추천 제품)가 나올 때",
    example: "OX 퀴즈, 피부 타입 설문 → 추천 제품, 심리 테스트",
    note: "문항과 결과 문구는 고객사에서 받습니다.",
  },
  RANDOM_DRAW: {
    group: "play",
    title: "랜덤 뽑기·추첨",
    when: "버튼을 누르면 결과가 무작위로 나올 때 (같은 결과 중복 방지 포함)",
    example: "오늘의 운세, 경품 추첨, 좌석 번호 추첨",
  },
  MINI_GAME: {
    group: "play",
    title: "고르기 게임 (이상형 월드컵 등)",
    when: "두 개 중 하나를 계속 골라 최종 1개를 뽑는 게임처럼, 선택을 이어가는 놀이가 있을 때",
    example: "이상형 월드컵, 최애 굿즈 토너먼트",
  },
  MULTI_LANG: {
    group: "play",
    title: "여러 언어로 보기",
    when: "외국인 방문객을 위해 화면에서 언어(영어·중국어·일본어 등)를 바꿀 수 있어야 할 때",
    note: "고객사가 언어별 화면 디자인을 따로 주면 고르지 않습니다(추가 비용 없음).",
  },
  AUDIO_BGM: {
    group: "play",
    title: "음악·안내 음성 나오게 하기",
    when: "키오스크에서 배경음악·효과음·안내 음성이 나와야 할 때",
    example: "헤드셋으로 듣는 BGM 청음, 촬영 카운트다운 음성",
    note: "음원 파일은 고객사에서 받습니다.",
  },

  // ── 결과 받아 가기 ──
  PRINT_SDK: {
    group: "deliver",
    title: "프린터로 출력하기",
    when: "카드·사진·영수증·티켓을 프린터로 뽑아야 할 때",
    note: "촬영·업로드·입력·선택 기능을 고르면 자동으로 함께 선택됩니다.",
  },
  MOBILE_SAVE: {
    group: "deliver",
    title: "휴대폰으로 결과 받기 (QR)",
    when: "인쇄와 별도로, 방문객이 QR코드를 찍어 결과 사진을 자기 휴대폰에 저장할 때",
    example: "포토카드 원본 사진을 휴대폰으로 저장",
  },
  SMS_SEND: {
    group: "deliver",
    title: "문자로 보내기",
    when: "방문객이 휴대폰 번호를 입력하면 결과나 영수증을 문자로 보내야 할 때",
    note: "개인정보 수집 동의 화면이 함께 들어갑니다. 문자 발송 요금은 별도일 수 있습니다.",
  },
  NFC_ENCODE: {
    group: "deliver",
    title: "카드 칩에 정보 넣기 (NFC)",
    when: "출력한 카드 칩 안에 정보(사번·출입 권한 등)를 기록해야 할 때",
    example: "출입증·사원증 발급",
    note: "카드를 대면 음악이 나오는 것처럼 '동작'만 필요하면 '카드·팔찌 대면 동작하기'를 고릅니다.",
  },

  // ── 결제·연동·운영 ──
  KSNET_PAY: {
    group: "link",
    title: "카드 결제 받기",
    when: "키오스크에서 방문객에게 신용카드로 결제를 받을 때",
    note: "고객사의 KSNET 가맹점 번호가 필요합니다.",
  },
  TAG_TRIGGER: {
    group: "link",
    title: "카드·팔찌 대면 동작하기",
    when: "방문객이 카드나 팔찌를 리더기에 대면 음악 재생·본인 확인 같은 동작이 일어나야 할 때",
    example: "카드 태그하면 선수 음성 재생, 입장 팔찌로 본인 확인",
    note: "리더기·카드 같은 장비는 견적에 포함되지 않습니다.",
  },
  LIST_UPLOAD: {
    group: "link",
    title: "참가자 명단 미리 넣기",
    when: "사전 신청자 명단(엑셀)을 미리 넣어 두고 현장에서 이름을 찾아 확인해야 할 때",
    example: "VIP 초청 명단 확인 후 좌석 추첨",
  },
  LIVE_DASHBOARD: {
    group: "link",
    title: "실시간 현황 보기 (운영자용)",
    when: "참여 인원·진행 상황을 운영자가 PC나 휴대폰으로 실시간으로 봐야 할 때",
  },
  MULTI_DEVICE: {
    group: "link",
    title: "여러 대 키오스크 함께 쓰기",
    when: "키오스크·태블릿 여러 대가 같은 데이터를 나눠 써야 할 때 (추첨 결과 중복 방지 등)",
    note: "기기가 6대 이상이거나 서버가 필요하면 개발팀이 금액을 조정합니다.",
  },
};

/** 요청 화면 표시용 묶음 키 */
export function guideGroupOf(code: string): GuideGroup | "etc" {
  return MODULE_GUIDE[code]?.group ?? "etc";
}
