# QuoteMaker Design System 하네스

claude.ai/design (Claude Design)과 동기화되는 디자인 시스템 번들.
현재 프로덕션 UI(`src/app`)에서 추출한 토큰·컴포넌트를 자체완결 HTML 프리뷰로 문서화한 것이며,
UX 개선 시안을 Claude Design에서 검토한 뒤 실제 코드에 반영하는 왕복 워크플로우의 기준점이다.

## 구조

```
design-system/
├── tokens.css              # 컬러/라운드/폰트 토큰 (Tailwind 값 추출)
├── foundations/
│   ├── colors.html         # 팔레트 + 상태/유형 시맨틱 컬러
│   └── typography.html     # Noto Sans KR 타입 스케일
├── components/
│   ├── buttons.html        # primary/secondary/danger/ghost + 상태
│   ├── badges.html         # 견적 상태 8종, 유형 3종, D-day
│   ├── inputs.html         # 텍스트/검색/셀렉트/체크박스/에러
│   ├── cards.html          # 스탯 카드, 콘텐츠 카드, 빈 상태
│   ├── table.html          # 견적 목록 테이블
│   └── navigation.html     # 헤더, 필터 필 그룹
├── patterns/
│   ├── quote-list.html     # 견적 목록 페이지 전체 조합 (현행)
│   └── login.html          # 로그인 페이지 전체 조합 (현행)
└── proposals/              # UX 개선 시안 — 시그니처: "파이프라인 스파인" (생애주기 스테퍼 공통 언어)
    ├── quote-list-v2.html  # 파이프라인 바 필터 + 오늘 할 일 스트립 + 모바일 카드뷰
    ├── quote-detail-v2.html# 상태 스테퍼 + 2컬럼 재배치 + 하단 고정 액션바
    └── request-form-v2.html# 위저드 스테퍼 통일 + 실시간 견적 요약 패널
```

각 HTML 첫 줄의 `<!-- @dsCard group="…" -->` 주석이 Claude Design 패널의 카드 인덱스가 된다.

## 소스 코드와의 매핑

| 프리뷰 | 소스 |
|---|---|
| badges | `src/types/index.ts` — `STATUS_COLORS`, `TYPE_COLORS` |
| table, cards, navigation | `src/app/dashboard/quotes/QuotesClient.tsx`, `DashboardShell.tsx` |
| login | `src/app/login/page.tsx` |
| typography | `src/app/layout.tsx` (Noto Sans KR 400/500/600/700) |

## 동기화 방법

Claude Code에서 `/design-sync` 실행 (DesignSync 도구):
1. 이 폴더의 HTML을 수정/추가
2. 대상 프로젝트: **QuoteMaker Design System** (claude.ai/design)
3. 변경된 파일만 증분 업로드 — 전체 교체 금지

## 규칙

- 프리뷰는 외부 리소스 없이 자체완결 (CDN·웹폰트 링크 금지, 인라인 CSS만)
- 색상 값은 `tokens.css`와 일치시킬 것 — 소스는 Tailwind 클래스이므로 여기 hex는 근사 문서값
- 코드(`src/`)가 진실의 원천. 디자인 변경이 확정되면 코드 → 프리뷰 순으로 갱신
