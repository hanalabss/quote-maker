// 항목별 단가 baseline 코어 로직 (scripts/analyze-baseline.js에서 이식)
// 순수 함수만 — 클라이언트/서버 공용. DB 조회는 API 라우트에서 수행.

// 항목명 정규화 — 같은 의미 항목들을 같은 그룹으로
export function normalizeItemName(name: string): string {
  let n = (name || "").toLowerCase();
  // 공통 노이즈 제거
  n = n.replace(/[\s\-·,()]/g, "");
  n = n.replace(/개발|구현|기능|작업|시스템|솔루션/g, "");
  // 도메인 키워드 매핑 (키워드 매치 → 통합 라벨)
  if (/내방신청|방문신청|신청.*웹|반응형.*신청/.test(n)) return "frontend_visit_apply";
  if (/qr.*스캔|qr.*모바일|모바일.*신청/.test(n)) return "frontend_qr_mobile";
  if (/키오스크|kiosk/.test(n)) return "frontend_kiosk";
  if (/담당자.*승인|승인.*웹|승인.*화면/.test(n)) return "frontend_approval";
  if (/관리자|어드민|admin/.test(n)) return "frontend_admin";
  if (/통계|리포트|report/.test(n)) return "feature_report";
  if (/api|백엔드|backend|서버/.test(n)) return "backend_api";
  if (/db.*to.*db|에스원.*db|db.*연동/.test(n)) return "integration_db";
  if (/본인인증|pass|인증/.test(n)) return "integration_auth";
  if (/카카오|알림톡|sms|알림/.test(n)) return "integration_notify";
  if (/qr.*발급|qr.*만료|qr.*코드/.test(n)) return "feature_qr_token";
  if (/권한/.test(n)) return "feature_permission";
  if (/예약/.test(n)) return "feature_reservation";
  if (/락커|locker/.test(n)) return "feature_locker";
  if (/테스트|qa|검증/.test(n)) return "qa_testing";
  if (/배포|호스팅|deploy/.test(n)) return "deployment";
  if (/기획|ux|ui.*설계/.test(n)) return "planning_ux";
  if (/유지보수/.test(n)) return "maintenance";
  return "other_" + (name || "").slice(0, 20);
}

export function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export interface BaselineStat {
  n: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p25: number;
  p75: number;
}

export function computeStats(arr: number[]): BaselineStat | null {
  if (!arr.length) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: Math.round(sum / arr.length),
    median: Math.round(quantile(arr, 0.5)),
    p25: Math.round(quantile(arr, 0.25)),
    p75: Math.round(quantile(arr, 0.75)),
  };
}

export type BaselineMap = Record<string, BaselineStat>;

// (라벨, 단가[]) 목록 → 라벨별 통계 맵
export function buildBaselineMap(rows: { itemName: string; unitPrice: number }[]): BaselineMap {
  const groups: Record<string, number[]> = {};
  for (const row of rows) {
    const label = normalizeItemName(row.itemName);
    if (label.startsWith("other_")) continue; // 그룹핑 불가 항목은 시세로 취급하지 않음
    (groups[label] ||= []).push(row.unitPrice);
  }
  const map: BaselineMap = {};
  for (const [label, prices] of Object.entries(groups)) {
    const s = computeStats(prices);
    if (s) map[label] = s;
  }
  return map;
}
