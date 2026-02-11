# QuoteMaker - 견적서 자동화 시스템

## Project Overview
하나플랫폼의 견적서 자동화 웹 애플리케이션.
사업팀이 질문지 폼을 입력하면 렌탈/행사 견적서가 자동 생성되고, 개발팀이 검토/승인 후 최종 견적서를 출력하는 시스템.

## URLs
- **Production**: https://quote-maker-alpha.vercel.app
- **GitHub**: https://github.com/hanalabss/quote-maker

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Email**: Resend
- **Excel Export**: ExcelJS
- **Deployment**: Vercel
- **Auth**: NextAuth.js (simple email/password)

## Architecture
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 로그인/회원가입
│   ├── (dashboard)/        # 대시보드 레이아웃
│   │   ├── quotes/         # 견적 목록/상세
│   │   └── modules/        # 모듈 가격 관리
│   ├── request/            # 사업팀 견적 요청 폼 (공개)
│   └── api/                # API Routes
│       ├── quotes/         # 견적 CRUD
│       ├── modules/        # 모듈 관리
│       ├── export/         # Excel/PDF 생성
│       └── auth/           # 인증
├── components/             # 공통 컴포넌트
│   ├── ui/                 # 기본 UI (Button, Input, Card 등)
│   ├── forms/              # 폼 컴포넌트
│   └── quote/              # 견적 관련 컴포넌트
├── lib/                    # 유틸리티
│   ├── db.ts               # Prisma client
│   ├── pricing.ts          # 가격 산정 엔진
│   ├── excel.ts            # Excel 생성
│   └── email.ts            # 이메일 발송
├── prisma/
│   └── schema.prisma       # DB 스키마
└── types/                  # TypeScript 타입 정의
```

## Data Model
- **User**: 사용자 (sales/dev role)
- **Quote**: 견적 요청 (상태: draft → pending → reviewing → approved → rejected)
- **QuoteItem**: 견적 항목 (모듈별 가격)
- **Module**: 모듈 마스터 (가격표)

## Business Logic

### 견적 유형
| 유형 | 코드 | 가격 배율 | 비고 |
|------|------|-----------|------|
| 렌탈 | rental | 100% (기본가) | 행사/전시 렌탈 |
| 재행사 | re_event | 30% (70% 할인) | 재행사 할인 |
| 판매 | sale | 130% (30% 추가) | 프로그램 판매 |

### 기본 모듈 가격표
| 코드 | 항목 | 기본 단가 |
|------|------|-----------|
| UI_BASIC | 키오스크 UI 개발 | 200,000 |
| PRINT_LOGIC | 인쇄/출력 로직 | 200,000 |
| SDK_SMART51 | Smart51 SDK 연동 | 100,000 |
| CAM_PHOTO | 카메라/촬영 기능 | 150,000 |
| QR_UPLOAD | QR코드 업로드 | 100,000 |
| TEXT_INPUT | 텍스트 입력 기능 | 100,000 |
| SERVER_SYNC | 서버 연동/데이터 저장 | 500,000 |
| AI_STYLE | AI 화풍변환 | 500,000 |
| AI_FEE | AI 외부 API 사용료 | 500,000 |
| TEST_QA | 테스트 및 유지보수 | 100,000 |

### 워크플로우
```
사업팀 폼 입력 → 모듈 자동 조합 → 견적 초안 생성 → 이메일 알림
→ 개발팀 검토/수정 → 승인 → 최종 견적서 Excel 다운로드
```

### 견적서 양식
- 기존 `0_견적서 양식.xlsx` 템플릿 기반
- 회사 정보: ㈜하나플랫폼, 대표 심건우
- 지불조건: 계약금 40%, 잔금 60%
- VAT 10% 별도

## Development Phases
- **Phase 1 (MVP)**: 렌탈/행사 견적 자동화 (현재)
- **Phase 2**: 프로그램 개발 견적 지원
- **Phase 3**: 견적 분석/리포트 대시보드
- **Phase 4**: 견적 히스토리 & 템플릿 재사용

## Conventions
- 컴포넌트: PascalCase (`QuoteForm.tsx`)
- 유틸/훅: camelCase (`usePricing.ts`)
- API Routes: kebab-case (`/api/quotes/[id]/approve`)
- 한글 주석 사용 가능, 코드는 영문
- Commit: conventional commits (feat:, fix:, docs:)

## Commands
```bash
npm run dev          # 개발 서버 (localhost:3100)
npm run build        # 빌드
npm run db:push      # DB 스키마 적용
npm run db:seed      # 초기 데이터 시드
npm run db:studio    # Prisma Studio
```
