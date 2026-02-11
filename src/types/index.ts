export type QuoteStatus = "draft" | "pending" | "reviewing" | "approved" | "rejected";
export type QuoteType = "sale" | "rental" | "re_event";
export type UserRole = "sales" | "dev";

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

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "임시저장",
  pending: "대기중",
  reviewing: "검토중",
  approved: "승인",
  rejected: "반려",
};

export const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  reviewing: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
