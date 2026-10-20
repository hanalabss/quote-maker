export type QuoteStatus = "draft" | "pending" | "reviewing" | "approved" | "on_hold" | "rejected" | "confirmed" | "completed" | "lost";
export type QuoteType = "sale" | "rental" | "re_event";
export type UserRole = "sales" | "dev" | "dev_staff";

export interface QuoteFormData {
  type: QuoteType;
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venue: string;
  deadline: string;
  expectedVisitors: string;
  requesterName: string;
  requesterContact: string;
  requesterEmail: string;
  screenDevice: string;
  screenResolution: string;
  printerType: string;
  networkType: string;
  printSize: string;
  notes: string;
  selectedModules: string[]; // module codes
}

export interface ModuleOption {
  code: string;
  name: string;
  category: string;
  description: string | null;
  basePrice: number;
  isAutoIncluded: boolean;
}

export const TYPE_LABELS: Record<QuoteType, string> = {
  sale: "판매",
  rental: "렌탈",
  re_event: "재행사",
};

export const TYPE_COLORS: Record<QuoteType, string> = {
  sale: "bg-orange-100 text-orange-700",
  rental: "bg-blue-100 text-blue-700",
  re_event: "bg-teal-100 text-teal-700",
};

export const TYPE_PRICE_RATE: Record<QuoteType, number> = {
  sale: 1.3,
  rental: 1.0,
  re_event: 0.3,
};

// 화면 흐름 모듈 — 하나라도 선택되면 UI_BASIC 필수 (견적에서 UI 개발 누락 방지)
export const UI_BASIC_TRIGGERS = ["CAM_PHOTO", "QR_UPLOAD", "TEXT_INPUT", "SELECT_PRINT"];

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "임시저장",
  pending: "대기중",
  reviewing: "검토중",
  approved: "승인",
  on_hold: "보류",
  rejected: "반려",
  confirmed: "확정",
  completed: "완료",
  lost: "미진행",
};

export const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  reviewing: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  on_hold: "bg-sky-100 text-sky-700",
  rejected: "bg-red-100 text-red-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-700",
  lost: "bg-gray-100 text-gray-500",
};
