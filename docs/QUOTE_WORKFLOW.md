# 견적 운영 워크플로우

> **Why**: 견적 다이어트 패턴(MAP 사례 -43%) 회피 + 단가 baseline 일관성 + 매출 다양화. /sc:business-panel(2026-05-07) 권고 기반.

## 🆕 신규 견적 작성 프로토콜

### 0. (선택) Discovery 단계 — 큰 건일 때
새로운 클라이언트 / 큰 스코프 (₩2,000만 이상 예상) 시:
- 무료/저렴(₩50만 이하) 진단 워크샵 제안
- 진짜 jobs-to-be-done 파악 (요구사항 ≠ 스펙)
- → MAP-style R1↔R3 다이어트 회피

### 1. 항목 분해
- **항목 단위로 가격 분해** (한 줄에 묶지 말고)
- 각 항목에 `isRequired` 마킹: 필수=true / 선택=false
- 견적서 비고 컬럼에 `[선택]` 자동 표시 (export 처리됨)

### 2. 단가 검증 (baseline 대조)
```bash
node scripts/analyze-baseline.js
```
- 항목별 floor (p25) 이상인지 확인
- floor 아래로 갈 시 ReferenceQuote에 `isException=true` + `exceptionReason` 명시
- **주의**: 자주 거래 협력사(원카드시스템) baseline 오염 위험 → 예외는 정말 예외만

### 3. DB 등록 + 엑셀 출력
```bash
node scripts/create-*-quote.js   # 신규
node scripts/update-*-quote.js   # 수정
node scripts/export-quote-local.js <quoteId> <outDir>
```
→ Excel COM 재저장 단계 잊지 말 것 (Excel 더블클릭 대비)

## 🔁 협상 룰 (다이어트 차단)

클라이언트가 단가 깎기 요청 시:

| 요청 유형 | 응대 |
|-----------|------|
| "B 항목 빼주세요" | ✅ 자동 차감 (B 빠짐 → 가격 자동 ↓) |
| "전체 가격 좀 더 싸게" | ❌ 거부. "어떤 항목을 빼시겠어요?" 역질문 |
| "X 항목 단가 좀 깎아주세요" | ❌ 거부. "스코프=가격" 원칙 설명 |
| "예산이 ₩X 한정이에요" | 항목별 cut 제안 → 클라이언트 선택 |

→ **scope cut은 OK, unit price 양보는 NO.**

## 📊 분기별 baseline review (분기말 1회)

매 분기 마지막 주에 실행:

```bash
node scripts/analyze-baseline.js > docs/baseline-review-YYYY-Q.md
```

확인사항:
1. **항목별 단가 trend** — ↑ 또는 stable 이면 OK, ↓이면 원인 분석 (다이어트 누적?)
2. **카테고리 집중도** — 단일 카테고리 > 70%면 다양화 우선순위 ↑
3. **Customer concentration** — 단일 협력사 매출 > 60%면 위험 신호
4. **Floor 위반 건수** — 예외 케이스 / 전체 건수 비율. > 30%면 floor 자체 재검토
5. **MAP-style 다이어트 사례** — R1 → 최종 차이 -30% 이상인 건들 분석

→ 결과로 `docs/PRICING_FLOOR.md` 갱신

## 🚨 단일 협력사 의존도 모니터링

- **현재 (2026-05-07)**: 원카드시스템 100% (9건 / 9건)
- **목표**: 다른 채널 매출 20% 이상 확보
- **모니터링 주기**: 분기별
- **임계값**: 단일 협력사 매출 > 70% → 다양화 액션 trigger

## 💡 매출 관리 KPI

ReferenceQuote에서 자동 산출 가능:
- 월별 매출 (예외 제외)
- 카테고리별 매출
- 평균 항목 단가 trend
- 다이어트 비율 (R1 vs final 차이 %)

→ 향후 dashboard 페이지로 시각화 (`/dashboard/references` 검토 시 추가)

## 🛠️ 시스템 도구 인덱스

| 도구 | 용도 | 사용 시점 |
|------|------|-----------|
| `scripts/analyze-baseline.js` | 항목별 단가 baseline 시세표 | 새 견적 작성 전, 분기 review |
| `scripts/import-reference-quotes.js` | 외부 견적서 일괄 import | 신규 폴더 추가 시 |
| `scripts/create-*-quote.js` | 신규 견적 등록 | 새 견적 작성 |
| `scripts/update-*-quote.js` | 기존 견적 수정 | 단가/항목 조정 |
| `scripts/export-quote-local.js` | 엑셀 출력 + Excel COM 재저장 | 견적서 발송 직전 |
| `docs/PRICING_FLOOR.md` | 항목별 floor + 권장 단가 | 단가 결정 가이드 |

## 📝 갱신 이력

- **2026-05-07 v1**: 최초 작성. /sc:business-panel 권고 기반 (Porter, Drucker, Taleb, Meadows, Collins, Christensen, Kim&Mauborgne 패널).
