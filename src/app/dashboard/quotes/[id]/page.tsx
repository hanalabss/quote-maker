"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Edit3,
  Download,
  Loader2,
  Save,
  Plus,
  Trash2,
  RotateCcw,
  Paperclip,
  FileText,
  Image,
  Music,
  MessageCircle,
  Send,
  CalendarCheck,
  CheckCheck,
  Ban,
  Clock,
} from "lucide-react";
import { formatKRW } from "@/lib/pricing";
import type { QuoteStatus, QuoteType } from "@/types";
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS } from "@/types";
import { normalizeItemName, type BaselineMap } from "@/lib/baseline";

interface QuoteItem {
  id: string;
  itemName: string;
  description: string | null;
  unitPrice: number;
  quantity: number;
  amount: number;
  note: string | null;
  moduleId: string | null;
}

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  type: string;
  eventName: string;
  eventDate: string | null;
  eventEndDate: string | null;
  venue: string | null;
  deadline: string | null;
  expectedVisitors: string | null;
  requesterName: string;
  requesterContact: string | null;
  requesterEmail: string | null;
  screenDevice: string | null;
  screenResolution: string | null;
  screenComposition: string | null;
  ksnetMerchantId: string | null;
  printerType: string | null;
  networkType: string | null;
  printSize: string | null;
  notes: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  revisionReason: string | null;
  confirmedAt: string | null;
  confirmedDate: string | null;
  confirmedEndDate: string | null;
  devDeadline: string | null;
  lostReason: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  attachments: { fileName: string; originalName: string; size: number; mimeType: string }[] | null;
  createdById: string | null;
  items: QuoteItem[];
  createdAt: string;
  createdBy?: { name: string; team: string; email: string } | null;
  reviewedBy?: { name: string } | null;
  comments?: QuoteCommentType[];
}

interface QuoteCommentType {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string; role: string; team: string | null };
}

// 견적 생애주기 파이프라인 (반려/미진행은 이탈 상태로 별도 배너 표시)
const PIPELINE: { key: QuoteStatus; label: string }[] = [
  { key: "pending", label: "대기중" },
  { key: "reviewing", label: "검토중" },
  { key: "approved", label: "승인" },
  { key: "confirmed", label: "확정" },
  { key: "completed", label: "완료" },
];

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "";
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function StatusStepper({ quote }: { quote: QuoteDetail }) {
  const idx = PIPELINE.findIndex((p) => p.key === quote.status);
  if (idx === -1) {
    // 이탈/사전 상태: 배너로 표시
    if (quote.status === "rejected") {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-6 flex items-center gap-2 text-sm text-red-700 font-medium">
          <XCircle className="w-4 h-4 shrink-0" />
          반려된 견적입니다. 아래 반려 사유를 확인해주세요.
        </div>
      );
    }
    if (quote.status === "lost") {
      return (
        <div className="bg-gray-100 border border-gray-200 rounded-xl px-5 py-3 mb-6 flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Ban className="w-4 h-4 shrink-0" />
          미진행 처리된 견적입니다.
        </div>
      );
    }
    return null;
  }

  const subLabel = (key: QuoteStatus): string => {
    switch (key) {
      case "pending":
        return fmtDate(quote.createdAt, true);
      case "reviewing":
        return quote.reviewedBy?.name ? `검토: ${quote.reviewedBy.name}` : "";
      case "approved":
        return "";
      case "confirmed":
        return quote.confirmedAt ? fmtDate(quote.confirmedAt) : "행사 확정 시";
      case "completed":
        return quote.confirmedEndDate ? `행사 종료 ${fmtDate(quote.confirmedEndDate)}` : "행사 종료 후";
      default:
        return "";
    }
  };

  return (
    <ol className="bg-white border rounded-xl px-4 sm:px-6 py-4 mb-6 flex overflow-x-auto" aria-label="견적 진행 상태">
      {PIPELINE.map((p, i) => {
        const state = i < idx ? "done" : i === idx ? "now" : "todo";
        return (
          <li key={p.key} className="flex-1 min-w-[76px] flex items-start gap-2 relative">
            <span
              className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] shrink-0 z-10 ${
                state === "done"
                  ? "bg-blue-600 text-white"
                  : state === "now"
                  ? "bg-white border-2 border-blue-600 text-blue-600 font-bold ring-4 ring-blue-100"
                  : "bg-gray-100 text-gray-400"
              }`}
              aria-hidden="true"
            >
              {state === "done" ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </span>
            {i < PIPELINE.length - 1 && (
              <span
                className={`absolute top-[12px] left-[34px] right-[8px] h-0.5 ${
                  state === "done" ? "bg-blue-600" : "bg-gray-200"
                }`}
                aria-hidden="true"
              />
            )}
            <span className="pr-2">
              <span
                className={`block text-[13px] leading-[26px] whitespace-nowrap ${
                  state === "todo" ? "text-gray-400" : "font-semibold"
                }`}
              >
                {p.label}
                {state === "now" && <span className="sr-only"> (현재 상태)</span>}
              </span>
              <span className={`block text-[11px] leading-tight whitespace-nowrap ${state === "now" ? "text-blue-600" : "text-gray-400"}`}>
                {subLabel(p.key)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<QuoteItem[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState("");
  const [confirmedEndDate, setConfirmedEndDate] = useState("");
  const [devDeadline, setDevDeadline] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [comments, setComments] = useState<QuoteCommentType[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  // 수정 요청 (사업팀, approved → reviewing)
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReasonInput, setRevisionReasonInput] = useState("");
  // 승인 가드레일 (soft gate)
  const [guardrailWarnings, setGuardrailWarnings] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  // 기본정보 수정
  const [showBasicEditModal, setShowBasicEditModal] = useState(false);
  const [basicForm, setBasicForm] = useState({
    eventDate: "", eventEndDate: "", venue: "", deadline: "",
    expectedVisitors: "", requesterContact: "", requesterEmail: "", notes: "",
  });
  // baseline 시세 (편집 모드 배지)
  const [baselineStats, setBaselineStats] = useState<BaselineMap | null>(null);
  const { user, isDev, isDevTeam } = useAuth();
  const showPrice = user?.role === "dev" || user?.role === "sales";
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setQuote(data);
        setEditItems(data.items || []);
        setReviewNote(data.reviewNote || "");
        setComments(data.comments || []);
        setLoading(false);
      });
  }, [id]);

  // 편집 모드 진입 시 참고 견적 시세(baseline) 로드 — dev 전용
  useEffect(() => {
    if (!editing || !isDev || baselineStats) return;
    fetch("/api/references/baseline")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stats) setBaselineStats(data.stats);
      })
      .catch(() => {});
  }, [editing, isDev, baselineStats]);



  async function deleteComment(commentId: string) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/quotes/${id}/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (e) {
      console.error("댓글 삭제 오류:", e);
    }
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/quotes/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setNewComment("");
      }
    } catch (e) {
      console.error("댓글 등록 오류:", e);
    }
    setCommentSaving(false);
  }

  async function updateStatus(status: string, extra?: Record<string, string>) {
    setSaving(true);
    const body: Record<string, string> = { status, ...extra };
    if (reviewNote) body.reviewNote = reviewNote;

    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setQuote(data);
      setGuardrailWarnings([]);
      setOverrideReason("");
      setShowRevisionModal(false);
      setRevisionReasonInput("");
    } else if (res.status === 422 && Array.isArray(data.warnings)) {
      // 승인 가드레일: 경고 확인 모달 표시
      setGuardrailWarnings(data.warnings);
      setOverrideReason("");
    } else {
      alert(data.error || "상태 변경에 실패했습니다");
    }
    setSaving(false);
    setShowRejectModal(false);
    setShowConfirmModal(false);
    setShowLostModal(false);
  }

  function openBasicEditModal() {
    if (!quote) return;
    setBasicForm({
      eventDate: quote.eventDate || "",
      eventEndDate: quote.eventEndDate || "",
      venue: quote.venue || "",
      deadline: quote.deadline || "",
      expectedVisitors: quote.expectedVisitors || "",
      requesterContact: quote.requesterContact || "",
      requesterEmail: quote.requesterEmail || "",
      notes: quote.notes || "",
    });
    setShowBasicEditModal(true);
  }

  async function saveBasicInfo() {
    setSaving(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ basicInfo: basicForm }),
    });
    const data = await res.json();
    if (res.ok) {
      setQuote(data);
      setShowBasicEditModal(false);
    } else {
      alert(data.error || "기본정보 수정에 실패했습니다");
    }
    setSaving(false);
  }

  async function saveItems() {
    setSaving(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: editItems.map((item) => ({
          itemName: item.itemName,
          description: item.description,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          note: item.note,
          moduleId: item.moduleId,
        })),
        reviewNote,
      }),
    });
    const data = await res.json();
    setQuote(data);
    setEditItems(data.items);
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/quotes");
    } else {
      const err = await res.json();
      alert(err.error || "삭제에 실패했습니다");
    }
    setSaving(false);
    setShowDeleteConfirm(false);
  }

  function updateEditItem(index: number, field: string, value: string | number) {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "unitPrice" || field === "quantity") {
          updated.amount = updated.unitPrice * updated.quantity;
        }
        return updated;
      })
    );
  }

  function addItem() {
    setEditItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        itemName: "",
        description: null,
        unitPrice: 0,
        quantity: 1,
        amount: 0,
        note: null,
        moduleId: null,
      },
    ]);
  }

  function removeItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  // 행사 확정 모달 열기 (일정 기본값 세팅)
  function openConfirmModal() {
    if (!quote) return;
    setConfirmedDate(quote.eventDate || "");
    setConfirmedEndDate(quote.eventEndDate || quote.eventDate || "");
    // devDeadline 기본값: 요청 시 입력한 납기일 우선, 없으면 행사일 기준 자동 계산
    if (quote.deadline) {
      setDevDeadline(quote.deadline);
    } else {
      const eventStart = quote.eventDate ? new Date(quote.eventDate + "T00:00:00") : null;
      if (eventStart) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const twoWeeksBefore = new Date(eventStart);
        twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
        const oneWeekBefore = new Date(eventStart);
        oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
        let deadline: Date;
        if (twoWeeksBefore >= today) {
          deadline = twoWeeksBefore;
        } else if (oneWeekBefore >= today) {
          deadline = oneWeekBefore;
        } else {
          deadline = today;
        }
        setDevDeadline(deadline.toISOString().split("T")[0]);
      } else {
        setDevDeadline("");
      }
    }
    setShowConfirmModal(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!quote) {
    return <div className="py-20 text-center text-gray-400">견적을 찾을 수 없습니다</div>;
  }

  const editSubtotal = editItems.reduce((s, item) => s + item.unitPrice * item.quantity, 0);
  const editVat = Math.round(editSubtotal * 0.1);
  const editTotal = editSubtotal + editVat;

  const canAct = user?.role === "sales" || user?.role === "dev";
  const showActionBar =
    !editing &&
    ((isDev && (quote.status === "pending" || quote.status === "reviewing")) ||
      (canAct && ["approved", "confirmed", "completed", "lost"].includes(quote.status)));

  return (
    <div className={showActionBar ? "pb-20" : ""}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/dashboard/quotes" className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="견적 목록으로 돌아가기">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-mono truncate">
              {quote.quoteNumber} · 요청 {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
            </p>
            <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 flex-wrap mt-0.5">
              <span className="truncate">{quote.eventName}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 font-medium ${
                  TYPE_COLORS[quote.type as QuoteType] || "bg-gray-100 text-gray-700"
                }`}
              >
                {TYPE_LABELS[quote.type as QuoteType] || quote.type}
              </span>
              {(quote.status === "rejected" || quote.status === "lost" || quote.status === "draft") && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 font-medium ${
                    STATUS_COLORS[quote.status]
                  }`}
                >
                  {STATUS_LABELS[quote.status]}
                </span>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/export/${id}`);
                if (!res.ok) throw new Error("export failed");
                const arrayBuffer = await res.arrayBuffer();
                const blob = new Blob([arrayBuffer], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = `${quote?.quoteNumber || "quote"}.xlsx`;
                a.style.display = "none";
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  URL.revokeObjectURL(blobUrl);
                  document.body.removeChild(a);
                }, 200);
              } catch (e) {
                console.error("다운로드 오류:", e);
                alert("다운로드에 실패했습니다.");
              }
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Excel </span>다운로드
          </button>
        </div>
      </div>

      <StatusStepper quote={quote} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 사이드: 행사/요청 정보 (모바일에서는 견적 항목 아래) */}
        <div className="lg:col-span-1 order-2 space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">행사 정보</h3>
              {["pending", "reviewing", "approved"].includes(quote.status) &&
                (isDev || quote.createdById === user?.id) && (
                  <button
                    onClick={openBasicEditModal}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    수정
                  </button>
                )}
            </div>
            <dl className="space-y-2 text-sm">
              {quote.eventDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">행사일</dt>
                  <dd>
                    {quote.eventDate}
                    {quote.eventEndDate && ` ~ ${quote.eventEndDate}`}
                  </dd>
                </div>
              )}
              {quote.venue && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">장소</dt>
                  <dd>{quote.venue}</dd>
                </div>
              )}
              {quote.deadline && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">납기일</dt>
                  <dd>{quote.deadline}</dd>
                </div>
              )}
              {quote.expectedVisitors && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">예상 방문객</dt>
                  <dd>{quote.expectedVisitors}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-medium mb-3">요청자 정보</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">이름</dt>
                <dd className="font-medium">{quote.requesterName}</dd>
              </div>
              {quote.requesterContact && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">연락처</dt>
                  <dd>{quote.requesterContact}</dd>
                </div>
              )}
              {quote.requesterEmail && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">이메일</dt>
                  <dd>{quote.requesterEmail}</dd>
                </div>
              )}
            </dl>
          </div>

          {(quote.screenDevice || quote.printerType || quote.networkType) && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-medium mb-3">장비/환경</h3>
              <dl className="space-y-2 text-sm">
                {quote.screenDevice && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">스크린</dt>
                    <dd>{quote.screenDevice}</dd>
                  </div>
                )}
                {quote.screenResolution && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">해상도</dt>
                    <dd>{quote.screenResolution}</dd>
                  </div>
                )}
                {quote.screenComposition && (
                  <div>
                    <dt className="text-gray-500 mb-1">화면 구성</dt>
                    <dd className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                      {(() => {
                        const labels: Record<string, string> = {
                          splash: "스플래시", camera: "카메라 촬영", qr: "QR 업로드",
                          image_select: "이미지 선택", select_print: "선택 인쇄",
                          text_input: "텍스트 입력", printing: "인쇄 진행 중", complete: "인쇄 완료",
                        };
                        try {
                          const arr = JSON.parse(quote.screenComposition) as string[];
                          return arr.map((v) => labels[v] || v).join(" → ");
                        } catch {
                          return quote.screenComposition;
                        }
                      })()}
                    </dd>
                  </div>
                )}
                {quote.ksnetMerchantId && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">KSNET 가맹점</dt>
                    <dd className="font-mono text-purple-700">{quote.ksnetMerchantId}</dd>
                  </div>
                )}
                {quote.printerType && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">프린터</dt>
                    <dd>{quote.printerType}</dd>
                  </div>
                )}
                {quote.networkType && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">네트워크</dt>
                    <dd>{quote.networkType}</dd>
                  </div>
                )}
                {quote.printSize && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">인쇄 사이즈</dt>
                    <dd>{quote.printSize}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {quote.notes && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-medium mb-2">기타 요청사항</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {quote.attachments && quote.attachments.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-medium mb-3 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4" />
                첨부 파일 ({quote.attachments.length})
              </h3>
              <div className="space-y-2">
                {quote.attachments.map((file) => (
                  <a
                    key={file.fileName}
                    href={`/api/attachments/${file.fileName}`}
                    download={file.originalName}
                    className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group"
                  >
                    {file.mimeType.startsWith("image/") ? (
                      <Image className="w-4 h-4 text-blue-500" />
                    ) : file.mimeType.startsWith("audio/") ? (
                      <Music className="w-4 h-4 text-purple-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate group-hover:text-blue-600">
                        {file.originalName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)}KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)}MB`}
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 메인: 견적 항목 + 검토/댓글 */}
        <div className="lg:col-span-2 order-1 space-y-4">
          {/* 견적 항목 */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">견적 항목</h3>
              {!editing && isDev &&(quote.status === "pending" || quote.status === "reviewing") && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Edit3 className="w-4 h-4" />
                  수정
                </button>
              )}
            </div>

            {editing ? (
              <>
                <div className="space-y-3">
                  {editItems.map((item, i) => (
                    <div key={item.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <div className="sm:col-span-2 lg:col-span-2">
                            <input
                              value={item.itemName}
                              onChange={(e) => updateEditItem(i, "itemName", e.target.value)}
                              placeholder="항목명"
                              className="w-full px-3 py-1.5 text-sm border rounded-lg"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateEditItem(i, "unitPrice", parseInt(e.target.value) || 0)
                              }
                              placeholder="단가"
                              className="w-full px-3 py-1.5 text-sm border rounded-lg text-right"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              = {formatKRW(item.unitPrice * item.quantity)}원
                            </span>
                          </div>
                        </div>
                        <input
                          value={item.description || ""}
                          onChange={(e) => updateEditItem(i, "description", e.target.value)}
                          placeholder="내용 (엑셀 견적서에 표시됩니다)"
                          className="w-full px-3 py-1.5 text-sm border rounded-lg text-gray-600"
                        />
                        {/* 참고 견적 시세 배지 */}
                        {(() => {
                          const stat = baselineStats?.[normalizeItemName(item.itemName)];
                          if (!stat) return null;
                          // 참고 견적은 SI 판매 건 — 렌탈/재행사에서는 정보성으로만 표시
                          const belowFloor =
                            quote.type === "sale" && stat.n >= 3 && item.unitPrice > 0 && item.unitPrice < stat.p25;
                          return (
                            <p className={`text-xs ${belowFloor ? "text-red-600 font-medium" : "text-gray-400"}`}>
                              판매 시세 중간값 {formatKRW(stat.median)}원 · 하한(p25) {formatKRW(stat.p25)}원
                              {stat.n < 3 ? ` · 표본 부족(n=${stat.n}) 참고만` : ` (n=${stat.n})`}
                              {belowFloor && " — 하한 미만!"}
                            </p>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => removeItem(i)}
                        className="p-1.5 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="flex items-center gap-1 mt-3 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-4 h-4" />
                  항목 추가
                </button>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">소계</span>
                    <span>{formatKRW(editSubtotal)}원</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">VAT (10%)</span>
                    <span>{formatKRW(editVat)}원</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-blue-200 pt-2">
                    <span>합계</span>
                    <span className="text-blue-600">{formatKRW(editTotal)}원</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditItems(quote.items);
                    }}
                    className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveItems}
                    disabled={saving}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    저장
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500 font-medium w-8">#</th>
                      <th className="text-left py-2 text-gray-500 font-medium">항목</th>
                      {showPrice && <th className="text-right py-2 text-gray-500 font-medium whitespace-nowrap">단가</th>}
                      {showPrice && <th className="text-right py-2 text-gray-500 font-medium whitespace-nowrap">금액</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item, i) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2.5 text-gray-400">{i + 1}</td>
                        <td className="py-2.5">
                          <div className="font-medium">{item.itemName}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500">{item.description}</div>
                          )}
                        </td>
                        {showPrice && <td className="py-2.5 text-right whitespace-nowrap">{formatKRW(item.unitPrice)}원</td>}
                        {showPrice && <td className="py-2.5 text-right font-medium whitespace-nowrap">{formatKRW(item.amount)}원</td>}
                      </tr>
                    ))}
                  </tbody>
                  {showPrice && (
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={3} className="py-2 text-gray-500">소계</td>
                      <td className="py-2 text-right whitespace-nowrap">{formatKRW(quote.subtotal)}원</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-2 text-gray-500">VAT (10%)</td>
                      <td className="py-2 text-right whitespace-nowrap">{formatKRW(quote.vat)}원</td>
                    </tr>
                    <tr className="border-t">
                      <td colSpan={3} className="py-2 font-bold">합계 (VAT 포함)</td>
                      <td className="py-2 text-right font-bold text-lg text-blue-600 whitespace-nowrap">
                        {formatKRW(quote.totalAmount)}원
                      </td>
                    </tr>
                  </tfoot>
                  )}
                </table>
                </div>
              </>
            )}
          </div>

          {/* 검토 메모 - dev만 */}
          {isDev &&(quote.status === "pending" || quote.status === "reviewing") && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-medium mb-3">검토 메모</h3>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder="검토 메모를 입력하세요 (선택)"
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          )}

          {/* 사업팀 수정 요청 사유 표시 (재검토 중) */}
          {quote.status === "reviewing" && quote.revisionReason && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <h3 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                사업팀 수정 요청
              </h3>
              <p className="text-sm text-amber-700 whitespace-pre-wrap">{quote.revisionReason}</p>
            </div>
          )}

          {/* 반려 사유 표시 */}
          {quote.status === "rejected" && quote.rejectionReason && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <h3 className="font-medium text-red-800 mb-2">반려 사유</h3>
              <p className="text-sm text-red-700">{quote.rejectionReason}</p>
            </div>
          )}

          {/* 검토 메모 표시 (reviewing 상태에서도 사업팀이 볼 수 있도록, dev는 textarea로 편집 중이므로 제외) */}
          {quote.reviewNote && quote.status !== "pending" && !(isDev && quote.status === "reviewing") && (
            <div className="bg-white rounded-xl border p-5 border-l-4 border-l-amber-400">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
                <h3 className="font-semibold text-gray-800 text-sm">개발팀 검토 메모</h3>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{quote.reviewNote}</p>
            </div>
          )}

          {/* 확정/완료 정보 표시 */}
          {(quote.status === "confirmed" || quote.status === "completed") && (
            <div className={`${quote.status === "completed" ? "bg-slate-50 border-slate-200" : "bg-emerald-50 border-emerald-200"} rounded-xl border p-5`}>
              <h3 className={`${quote.status === "completed" ? "text-slate-800" : "text-emerald-800"} font-medium mb-3 flex items-center gap-2`}>
                {quote.status === "completed" ? <CheckCheck className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />}
                {quote.status === "completed" ? "행사 완료" : "행사 확정 정보"}
              </h3>
              <dl className="space-y-2 text-sm">
                {quote.confirmedDate && (
                  <div className="flex justify-between">
                    <dt className={quote.status === "completed" ? "text-slate-600" : "text-emerald-600"}>행사 기간</dt>
                    <dd className="font-medium">
                      {quote.confirmedDate}
                      {quote.confirmedEndDate && quote.confirmedEndDate !== quote.confirmedDate && ` ~ ${quote.confirmedEndDate}`}
                    </dd>
                  </div>
                )}
                {quote.status === "confirmed" && (
                  <div className="flex justify-between">
                    <dt className="text-emerald-600">개발 마감일</dt>
                    <dd className="font-bold text-red-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {quote.devDeadline}
                      {quote.devDeadline && (() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const deadline = new Date(quote.devDeadline + "T00:00:00");
                        const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (diff < 0) return <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{Math.abs(diff)}일 초과</span>;
                        if (diff === 0) return <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">오늘 마감</span>;
                        return <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">D-{diff}</span>;
                      })()}
                    </dd>
                  </div>
                )}
                {quote.status === "completed" && quote.devDeadline && (
                  <div className="flex justify-between">
                    <dt className="text-slate-600">개발 마감일</dt>
                    <dd className="text-gray-600">{quote.devDeadline}</dd>
                  </div>
                )}
                {quote.confirmedAt && (
                  <div className="flex justify-between">
                    <dt className={quote.status === "completed" ? "text-slate-600" : "text-emerald-600"}>확정일</dt>
                    <dd className="text-gray-600">{new Date(quote.confirmedAt).toLocaleDateString("ko-KR")}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* 미진행 사유 표시 */}
          {quote.status === "lost" && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-600 mb-2 flex items-center gap-2">
                <Ban className="w-4 h-4" />
                미진행 처리됨
              </h3>
              {quote.lostReason && <p className="text-sm text-gray-500">{quote.lostReason}</p>}
            </div>
          )}

          {/* 댓글 섹션 */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-medium mb-4 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" />
              댓글 ({comments.length})
            </h3>

            {comments.length > 0 ? (
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className={`p-3 rounded-lg ${c.user.role === "dev" ? "bg-blue-50 border border-blue-100" : "bg-gray-50 border border-gray-100"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{c.user.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${c.user.role === "dev" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                        {c.user.role === "dev" ? "개발팀" : "사업팀"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {(isDev || c.user.name === user?.name) && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-4">아직 댓글이 없습니다</p>
            )}

            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                rows={2}
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />
              <button
                onClick={addComment}
                disabled={!newComment.trim() || commentSaving}
                className="self-end px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {commentSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 삭제 버튼 - dev: 완전삭제, 요청자: 숨김 */}
          {(isDev || quote.createdById === user?.id) && (
            <div className="pt-4 border-t">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {isDev ? "견적 삭제" : "견적 삭제 (내 목록에서 숨김)"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 하단 고정 액션바: 스크롤 위치와 무관하게 상태 전환 가능 */}
      {showActionBar && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
            <div className="min-w-0 mr-auto flex items-center gap-2 text-xs sm:text-sm text-gray-500">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[quote.status]}`}
              >
                {STATUS_LABELS[quote.status]}
              </span>
              <span className="hidden sm:inline truncate">
                항목 {quote.items.length}개
                {showPrice && (
                  <>
                    {" "}· 합계 <b className="text-gray-900 tabular-nums">{formatKRW(quote.totalAmount)}원</b>
                  </>
                )}
              </span>
              {quote.status === "approved" && (
                <span className="hidden lg:inline text-amber-700">
                  클라이언트 확인 후 확정 또는 미진행을 선택해주세요
                </span>
              )}
            </div>

            {isDev && quote.status === "pending" && (
              <button
                onClick={() => updateStatus("reviewing")}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                검토 시작
              </button>
            )}

            {isDev && quote.status === "reviewing" && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  반려
                </button>
                <button
                  onClick={() => updateStatus("approved")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  승인
                </button>
              </>
            )}

            {quote.status === "approved" && canAct && (
              <>
                {isDev && (
                  <button
                    onClick={() => updateStatus("reviewing")}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">승인 철회</span>
                  </button>
                )}
                {user?.role === "sales" && (
                  <button
                    onClick={() => { setRevisionReasonInput(""); setShowRevisionModal(true); }}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-amber-700 border border-amber-200 bg-white rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    수정 요청
                  </button>
                )}
                <button
                  onClick={() => setShowLostModal(true)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  미진행
                </button>
                <button
                  onClick={openConfirmModal}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <CalendarCheck className="w-4 h-4" />
                  행사 확정
                </button>
              </>
            )}

            {quote.status === "confirmed" && canAct && (
              <>
                <button
                  onClick={() => updateStatus("approved")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">승인으로 되돌리기</span>
                </button>
                <button
                  onClick={() => updateStatus("completed")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  행사 완료 처리
                </button>
              </>
            )}

            {quote.status === "completed" && canAct && (
              <button
                onClick={() => updateStatus("confirmed")}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-emerald-700 border border-emerald-200 bg-white rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                확정 상태로 되돌리기
              </button>
            )}

            {quote.status === "lost" && canAct && (
              <button
                onClick={() => updateStatus("approved")}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                승인 상태로 되돌리기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowDeleteConfirm(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-title" className="text-lg font-semibold mb-2">
              {isDev ? "견적 삭제" : "견적 숨김"}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {isDev
                ? "이 견적을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다."
                : "이 견적이 내 목록에서 숨겨집니다. 관리자는 계속 볼 수 있습니다."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDev ? "삭제" : "숨기기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확정 모달 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowConfirmModal(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-title" className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
              행사 확정
            </h3>
            <div className="space-y-4">
              {quote.type !== "sale" && (
                <>
                  <div>
                    <label htmlFor="confirmedDate" className="block text-sm font-medium text-gray-700 mb-1">행사 시작일 <span className="text-red-500">*</span></label>
                    <input
                      id="confirmedDate"
                      type="date"
                      value={confirmedDate}
                      onChange={(e) => setConfirmedDate(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmedEndDate" className="block text-sm font-medium text-gray-700 mb-1">행사 종료일 <span className="text-red-500">*</span></label>
                    <input
                      id="confirmedEndDate"
                      type="date"
                      value={confirmedEndDate}
                      onChange={(e) => setConfirmedEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="devDeadline" className="block text-sm font-medium text-gray-700 mb-1">개발 마감일 <span className="text-red-500">*</span></label>
                <input
                  id="devDeadline"
                  type="date"
                  value={devDeadline}
                  onChange={(e) => setDevDeadline(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {quote.deadline
                    ? "요청 시 입력한 납기일이 자동 반영됩니다. 필요 시 수정하세요."
                    : "개발팀이 준비를 완료해야 하는 날짜 (행사 2주 전 자동 계산)"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const lines: string[] = [];
                  if (quote.type !== "sale") {
                    lines.push(`• 행사 시작일: ${confirmedDate || "(미입력)"}`);
                    lines.push(`• 행사 종료일: ${confirmedEndDate || "(미입력)"}`);
                  }
                  lines.push(`• 개발 마감일: ${devDeadline || "(미입력)"}`);
                  const msg = `아래 일정이 맞는지 다시 한 번 확인해 주세요.\n\n${lines.join("\n")}\n\n이대로 확정하시겠습니까?`;
                  if (!window.confirm(msg)) return;
                  updateStatus("confirmed", {
                    confirmedDate: quote.type === "sale" ? new Date().toISOString().split("T")[0] : confirmedDate,
                    confirmedEndDate,
                    devDeadline,
                  });
                }}
                disabled={
                  (quote.type !== "sale" && (!confirmedDate || !confirmedEndDate)) ||
                  !devDeadline ||
                  saving
                }
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "확정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미진행 모달 */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLostModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowLostModal(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" role="dialog" aria-modal="true" aria-labelledby="lost-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="lost-title" className="text-lg font-semibold mb-4">미진행 처리</h3>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              rows={3}
              placeholder="미진행 사유를 입력해주세요 (선택)"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-gray-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLostModal(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => updateStatus("lost", { lostReason })}
                disabled={saving}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                미진행 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 요청 모달 (사업팀, approved → reviewing) */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRevisionModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowRevisionModal(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" role="dialog" aria-modal="true" aria-labelledby="revision-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="revision-title" className="text-lg font-semibold mb-2">견적 수정 요청</h3>
            <p className="text-sm text-gray-500 mb-4">
              견적이 <strong>검토중</strong> 상태로 돌아가고 개발팀에 알림이 발송됩니다.
            </p>
            <textarea
              value={revisionReasonInput}
              onChange={(e) => setRevisionReasonInput(e.target.value)}
              rows={4}
              placeholder="어떤 부분을 수정해야 하는지 구체적으로 적어주세요 (예: 고객사 요청으로 QR 업로드 제외, 금액 조정 필요)"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => updateStatus("reviewing", { revisionReason: revisionReasonInput })}
                disabled={!revisionReasonInput.trim() || saving}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "수정 요청"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인 가드레일 모달 (soft gate) */}
      {guardrailWarnings.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setGuardrailWarnings([])} onKeyDown={(e) => { if (e.key === "Escape") setGuardrailWarnings([]); }}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full" role="dialog" aria-modal="true" aria-labelledby="guardrail-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="guardrail-title" className="text-lg font-semibold mb-2 flex items-center gap-2 text-amber-700">
              <Clock className="w-5 h-5" />
              승인 전 확인이 필요합니다
            </h3>
            <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {guardrailWarnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {w}
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-500 mb-2">
              항목을 수정하려면 취소 후 <strong>견적 항목 &gt; 수정</strong>에서 조정하세요.
              그대로 승인하려면 사유를 입력해주세요 (검토 메모에 기록됩니다).
            </p>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              placeholder="무시 사유 (예: 고객사 협의 완료된 특별 단가)"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setGuardrailWarnings([])}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소 (항목 수정)
              </button>
              <button
                onClick={() => updateStatus("approved", { overrideReason })}
                disabled={!overrideReason.trim() || saving}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "무시하고 승인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기본정보 수정 모달 */}
      {showBasicEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBasicEditModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowBasicEditModal(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="basic-edit-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="basic-edit-title" className="text-lg font-semibold mb-1">기본정보 수정</h3>
            <p className="text-xs text-gray-400 mb-4">
              가격에 영향 없는 정보만 수정할 수 있습니다. 기능/항목 변경은 수정 요청을 이용하세요.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="be-eventDate" className="block text-xs font-medium text-gray-600 mb-1">행사 시작일</label>
                  <input id="be-eventDate" type="date" value={basicForm.eventDate}
                    onChange={(e) => setBasicForm((p) => ({ ...p, eventDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label htmlFor="be-eventEndDate" className="block text-xs font-medium text-gray-600 mb-1">행사 종료일</label>
                  <input id="be-eventEndDate" type="date" value={basicForm.eventEndDate}
                    onChange={(e) => setBasicForm((p) => ({ ...p, eventEndDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="be-venue" className="block text-xs font-medium text-gray-600 mb-1">행사 장소</label>
                  <input id="be-venue" type="text" value={basicForm.venue}
                    onChange={(e) => setBasicForm((p) => ({ ...p, venue: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label htmlFor="be-deadline" className="block text-xs font-medium text-gray-600 mb-1">납기일</label>
                  <input id="be-deadline" type="date" value={basicForm.deadline}
                    onChange={(e) => setBasicForm((p) => ({ ...p, deadline: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="be-visitors" className="block text-xs font-medium text-gray-600 mb-1">예상 방문객</label>
                <input id="be-visitors" type="text" value={basicForm.expectedVisitors}
                  onChange={(e) => setBasicForm((p) => ({ ...p, expectedVisitors: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="be-contact" className="block text-xs font-medium text-gray-600 mb-1">연락처</label>
                  <input id="be-contact" type="tel" value={basicForm.requesterContact}
                    onChange={(e) => setBasicForm((p) => ({ ...p, requesterContact: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label htmlFor="be-email" className="block text-xs font-medium text-gray-600 mb-1">이메일</label>
                  <input id="be-email" type="email" value={basicForm.requesterEmail}
                    onChange={(e) => setBasicForm((p) => ({ ...p, requesterEmail: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="be-notes" className="block text-xs font-medium text-gray-600 mb-1">기타 요청사항</label>
                <textarea id="be-notes" rows={3} value={basicForm.notes}
                  onChange={(e) => setBasicForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowBasicEditModal(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={saveBasicInfo}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 반려 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRejectModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowRejectModal(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" role="dialog" aria-modal="true" aria-labelledby="reject-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="reject-title" className="text-lg font-semibold mb-4">견적 반려</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="반려 사유를 입력해주세요"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => updateStatus("rejected", { rejectionReason })}
                disabled={!rejectionReason || saving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                반려 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
