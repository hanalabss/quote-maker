"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
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
  Paperclip,
  FileText,
  Image,
  Music,
} from "lucide-react";
import { formatKRW } from "@/lib/pricing";
import type { QuoteStatus } from "@/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";

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
  subtotal: number;
  vat: number;
  totalAmount: number;
  attachments: { fileName: string; originalName: string; size: number; mimeType: string }[] | null;
  items: QuoteItem[];
  createdAt: string;
  createdBy?: { name: string; team: string; email: string } | null;
  reviewedBy?: { name: string } | null;
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

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setQuote(data);
        setEditItems(data.items || []);
        setReviewNote(data.reviewNote || "");
        setLoading(false);
      });
  }, [id]);



  async function updateStatus(status: string, reason?: string) {
    setSaving(true);
    const body: Record<string, string> = { status };
    if (reason) body.rejectionReason = reason;
    if (reviewNote) body.reviewNote = reviewNote;

    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setQuote(data);
    setSaving(false);
    setShowRejectModal(false);
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/dashboard/quotes" className="text-gray-400 hover:text-gray-600 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold flex items-center gap-2">
              <span className="truncate">{quote.quoteNumber}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 ${
                  STATUS_COLORS[quote.status]
                }`}
              >
                {STATUS_LABELS[quote.status]}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{quote.eventName}</p>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 왼쪽: 기본 정보 */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-medium mb-3">기본 정보</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">행사명</dt>
                <dd className="font-medium text-right">{quote.eventName}</dd>
              </div>
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

        {/* 오른쪽: 견적 항목 + 액션 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 견적 항목 */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">견적 항목</h3>
              {!editing && (quote.status === "pending" || quote.status === "reviewing") && (
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
                      <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="sm:col-span-2 lg:col-span-2">
                          <input
                            value={item.itemName}
                            onChange={(e) => updateEditItem(i, "itemName", e.target.value)}
                            placeholder="항목명"
                            className="w-full px-3 py-1.5 text-sm border rounded-md"
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
                            className="w-full px-3 py-1.5 text-sm border rounded-md text-right"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            = {formatKRW(item.unitPrice * item.quantity)}원
                          </span>
                        </div>
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
                      <th className="text-right py-2 text-gray-500 font-medium whitespace-nowrap">단가</th>
                      <th className="text-right py-2 text-gray-500 font-medium whitespace-nowrap">금액</th>
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
                        <td className="py-2.5 text-right">{formatKRW(item.unitPrice)}원</td>
                        <td className="py-2.5 text-right font-medium">{formatKRW(item.amount)}원</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={3} className="py-2 text-gray-500">소계</td>
                      <td className="py-2 text-right">{formatKRW(quote.subtotal)}원</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-2 text-gray-500">VAT (10%)</td>
                      <td className="py-2 text-right">{formatKRW(quote.vat)}원</td>
                    </tr>
                    <tr className="border-t">
                      <td colSpan={3} className="py-2 font-bold">합계 (VAT 포함)</td>
                      <td className="py-2 text-right font-bold text-lg text-blue-600">
                        {formatKRW(quote.totalAmount)}원
                      </td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </>
            )}
          </div>

          {/* 검토 메모 */}
          {(quote.status === "pending" || quote.status === "reviewing") && (
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

          {/* 반려 사유 표시 */}
          {quote.status === "rejected" && quote.rejectionReason && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <h3 className="font-medium text-red-800 mb-2">반려 사유</h3>
              <p className="text-sm text-red-700">{quote.rejectionReason}</p>
            </div>
          )}

          {/* 검토 메모 표시 */}
          {quote.reviewNote && quote.status !== "pending" && quote.status !== "reviewing" && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
              <h3 className="font-medium text-blue-800 mb-2">검토 메모</h3>
              <p className="text-sm text-blue-700">{quote.reviewNote}</p>
            </div>
          )}

          {/* 액션 버튼 */}
          {(quote.status === "pending" || quote.status === "reviewing") && (
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {quote.status === "pending" && (
                <button
                  onClick={() => updateStatus("reviewing")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  검토 시작
                </button>
              )}
              <button
                onClick={() => updateStatus("approved")}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                승인
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                반려
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 반려 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">견적 반려</h3>
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
                onClick={() => updateStatus("rejected", rejectionReason)}
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
