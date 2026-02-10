"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, Send, Loader2, Paperclip, X, FileText, Image, Music } from "lucide-react";
import Link from "next/link";
import { formatKRW } from "@/lib/pricing";

interface Module {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  basePrice: number;
  isAutoIncluded: boolean;
  sortOrder: number;
}

const STEPS = ["기본 정보", "기능 선택", "상세 옵션", "미리보기"];

const SCREEN_DEVICES = [
  { value: "kiosk", label: "키오스크" },
  { value: "tablet", label: "태블릿" },
  { value: "laptop", label: "노트북" },
];

const RESOLUTIONS = [
  { value: "1080x1920", label: "1080x1920 (세로)" },
  { value: "1920x1080", label: "1920x1080 (가로)" },
];

const PRINTERS = [
  { value: "Smart31", label: "Smart31" },
  { value: "Smart51", label: "Smart51" },
  { value: "Joyspace", label: "Joyspace" },
  { value: "Luka", label: "Luka" },
  { value: "none", label: "프린터 없음" },
];

const NETWORKS = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "offline", label: "오프라인" },
  { value: "both", label: "Wi-Fi + 오프라인 모두" },
];

const SCREEN_FLOWS = [
  { value: "splash", label: "스플래시" },
  { value: "camera", label: "카메라 촬영" },
  { value: "qr", label: "QR 업로드" },
  { value: "select_print", label: "이미지 선택/인쇄" },
  { value: "text_input", label: "텍스트 입력" },
  { value: "printing", label: "인쇄 진행 중" },
  { value: "complete", label: "인쇄 완료" },
];

const KSNET_PRICE = 300000;
const SELECT_PRINT_PRICE = 150000;

// 이 모듈 중 하나라도 선택되면 PRINT_SDK 자동 선택
const PRINT_SDK_TRIGGERS = ["CAM_PHOTO", "QR_UPLOAD", "TEXT_INPUT", "SELECT_PRINT"];

interface Attachment {
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
}

interface AuthUser {
  id: string;
  loginId: string;
  name: string;
  role: string;
  team: string | null;
  position: string | null;
}

export default function RequestPage() {
  const [step, setStep] = useState(0);
  const [modules, setModules] = useState<Module[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    eventName: "",
    eventDate: "",
    eventEndDate: "",
    venue: "",
    deadline: "",
    expectedVisitors: "",
    requesterName: "",
    requesterContact: "",
    requesterEmail: "",
    screenDevice: "",
    screenResolution: "",
    printerType: "",
    networkType: "",
    printSize: "",
    notes: "",
    selectedModules: [] as string[],
    screenComposition: [] as string[],
    useDbLogging: false,
    useKsnetPayment: false,
    ksnetMerchantId: "",
  });

  useEffect(() => {
    fetch("/api/modules")
      .then((r) => r.json())
      .then(setModules);

    // 로그인 사용자 정보 가져오기 → 요청자명 자동 채우기
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUser(data);
          setForm((prev) => ({
            ...prev,
            requesterName: prev.requesterName || data.name,
          }));
        }
      });
  }, []);

  const selectedModuleData = modules.filter(
    (m) => form.selectedModules.includes(m.code) || m.isAutoIncluded
  );
  const ksnetExtra = form.useKsnetPayment ? KSNET_PRICE : 0;
  const selectPrintExtra = form.screenComposition.includes("select_print") ? SELECT_PRINT_PRICE : 0;
  const subtotal = selectedModuleData.reduce((s, m) => s + m.basePrice, 0) + ksnetExtra + selectPrintExtra;
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;

  function updateForm(key: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleModule(code: string) {
    setForm((prev) => {
      const isSelected = prev.selectedModules.includes(code);
      let next = isSelected
        ? prev.selectedModules.filter((c) => c !== code)
        : [...prev.selectedModules, code];

      // 트리거 모듈을 켤 때 PRINT_SDK 자동 추가
      if (!isSelected && PRINT_SDK_TRIGGERS.includes(code) && !next.includes("PRINT_SDK")) {
        next = [...next, "PRINT_SDK"];
      }

      return { ...prev, selectedModules: next };
    });
  }

  function toggleScreen(value: string) {
    setForm((prev) => ({
      ...prev,
      screenComposition: prev.screenComposition.includes(value)
        ? prev.screenComposition.filter((v) => v !== value)
        : [...prev.screenComposition, value],
    }));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function getFileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
    if (mimeType.startsWith("audio/")) return <Music className="w-4 h-4 text-purple-500" />;
    return <FileText className="w-4 h-4 text-gray-500" />;
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "파일 업로드에 실패했습니다");
        return;
      }
      const uploaded: Attachment[] = await res.json();
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      alert("파일 업로드 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "rental", attachments }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "오류가 발생했습니다");
        return;
      }
      const data = await res.json();
      setQuoteNumber(data.quoteNumber);
      setSubmitted(true);
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  const canProceed = () => {
    if (step === 0) return form.eventName && form.requesterName;
    if (step === 1) return form.selectedModules.length > 0;
    return true;
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">견적 요청 완료</h1>
          <p className="text-gray-500 mb-6">
            견적번호: <span className="font-mono font-bold text-gray-900">{quoteNumber}</span>
          </p>
          <p className="text-sm text-gray-400 mb-8">
            개발팀에 알림이 전송되었습니다. 검토 후 연락드리겠습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              홈으로
            </Link>
            <button
              onClick={() => {
                setSubmitted(false);
                setStep(0);
                setForm({
                  eventName: "", eventDate: "", eventEndDate: "", venue: "",
                  deadline: "", expectedVisitors: "", requesterName: user?.name || "",
                  requesterContact: "", requesterEmail: "", screenDevice: "",
                  screenResolution: "", printerType: "", networkType: "",
                  printSize: "", notes: "", selectedModules: [],
                  screenComposition: [], useDbLogging: false,
                  useKsnetPayment: false, ksnetMerchantId: "",
                });
                setAttachments([]);
              }}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              새 견적 요청
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">견적 요청</h1>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                  i < step
                    ? "bg-blue-600 text-white"
                    : i === step
                    ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:block ${
                  i === step ? "text-blue-700 font-medium" : "text-gray-400"
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < step ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 sm:p-8">
          {/* Step 0: 기본 정보 */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold mb-6">기본 정보</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  행사명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.eventName}
                  onChange={(e) => updateForm("eventName", e.target.value)}
                  placeholder="예: 2026 하나플랫폼 키오스크 전시회"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">행사 시작일</label>
                  <input
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => updateForm("eventDate", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">행사 종료일</label>
                  <input
                    type="date"
                    value={form.eventEndDate}
                    onChange={(e) => updateForm("eventEndDate", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">행사 장소</label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => updateForm("venue", e.target.value)}
                    placeholder="예: 코엑스"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">납기일</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => updateForm("deadline", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">예상 방문객 수</label>
                <input
                  type="text"
                  value={form.expectedVisitors}
                  onChange={(e) => updateForm("expectedVisitors", e.target.value)}
                  placeholder="예: 약 3,000명"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <hr />
              <h3 className="text-lg font-medium">요청자 정보</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  요청자명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.requesterName}
                  onChange={(e) => updateForm("requesterName", e.target.value)}
                  placeholder="이름"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처</label>
                  <input
                    type="text"
                    value={form.requesterContact}
                    onChange={(e) => updateForm("requesterContact", e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                  <input
                    type="email"
                    value={form.requesterEmail}
                    onChange={(e) => updateForm("requesterEmail", e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: 기능 선택 */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">단가표</h2>
              <p className="text-sm text-gray-500 mb-6">
                필요한 기능을 선택해주세요. 테스트 및 유지보수는 자동 포함됩니다.
              </p>
              <div className="space-y-3">
                {modules
                  .filter((m) => !m.isAutoIncluded)
                  .map((mod) => {
                    const selected = form.selectedModules.includes(mod.code);
                    const isNegotiable = mod.code === "AI_STYLE" && mod.basePrice === 0;
                    return (
                      <button
                        key={mod.code}
                        onClick={() => toggleModule(mod.code)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                  selected
                                    ? "bg-blue-600 border-blue-600"
                                    : "border-gray-300"
                                }`}
                              >
                                {selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-xs text-gray-400 font-mono">{mod.sortOrder}.</span>
                              <span className="font-medium">{mod.name}</span>
                            </div>
                            {mod.description && (
                              <p className="text-sm text-gray-500 mt-1 ml-7">
                                {mod.description}
                              </p>
                            )}
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ml-4 ${isNegotiable ? "text-orange-600" : "text-blue-600"}`}>
                            {isNegotiable ? "협의" : `${formatKRW(mod.basePrice)}원`}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                {/* 자동 포함 항목 */}
                {modules
                  .filter((m) => m.isAutoIncluded)
                  .map((mod) => (
                    <div
                      key={mod.code}
                      className="p-4 rounded-xl border-2 border-dashed border-green-300 bg-green-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-green-600 border-2 border-green-600 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{mod.sortOrder}.</span>
                          <span className="font-medium">{mod.name}</span>
                          <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">
                            자동 포함
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          {formatKRW(mod.basePrice)}원
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* 소계 */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>소계</span>
                  <span>{formatKRW(subtotal)}원</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>VAT (10%)</span>
                  <span>{formatKRW(vat)}원</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>합계 (VAT 포함)</span>
                  <span className="text-blue-600">{formatKRW(total)}원</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 상세 옵션 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold mb-6">상세 옵션</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">스크린 기기</label>
                <div className="flex flex-wrap gap-2">
                  {SCREEN_DEVICES.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => updateForm("screenDevice", d.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.screenDevice === d.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">화면 해상도</label>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => updateForm("screenResolution", r.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.screenResolution === r.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 화면 구성 선택 - UI_BASIC 모듈 선택 시 표시 */}
              {form.selectedModules.includes("UI_BASIC") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    화면 스크린 구성
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    키오스크에 포함될 화면 흐름을 선택해주세요
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SCREEN_FLOWS.map((s) => {
                      const selected = form.screenComposition.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          onClick={() => toggleScreen(s.value)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            selected
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              selected
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-300"
                            }`}
                          >
                            {selected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.screenComposition.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-600">
                        {form.screenComposition
                          .map((v) => SCREEN_FLOWS.find((s) => s.value === v)?.label)
                          .join(" → ")}
                      </p>
                      {form.screenComposition.includes("select_print") && (
                        <p className="text-xs text-purple-600 mt-1">
                          * 선택 인쇄 기능 포함 (+{formatKRW(SELECT_PRINT_PRICE)}원)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">프린터 종류</label>
                <div className="flex flex-wrap gap-2">
                  {PRINTERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => updateForm("printerType", p.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.printerType === p.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">인쇄물 사이즈</label>
                <input
                  type="text"
                  value={form.printSize}
                  onChange={(e) => updateForm("printSize", e.target.value)}
                  placeholder="예: 55x45mm, 8pt 맑은고딕체"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">네트워크 환경</label>
                <div className="flex flex-wrap gap-2">
                  {NETWORKS.map((n) => (
                    <button
                      key={n.value}
                      onClick={() => updateForm("networkType", n.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.networkType === n.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 서비스/부가 항목 - 온라인(wifi/both) 선택 시만 표시 */}
              {(form.networkType === "wifi" || form.networkType === "both") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    서비스 / 부가 항목
                  </label>
                  <div className="space-y-3">
                    {/* DB 로그 서비스 */}
                    <button
                      onClick={() => setForm((prev) => ({ ...prev, useDbLogging: !prev.useDbLogging }))}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        form.useDbLogging
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                form.useDbLogging
                                  ? "bg-green-600 border-green-600"
                                  : "border-gray-300"
                              }`}
                            >
                              {form.useDbLogging && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-medium">DB 직접 연결 로그</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              서비스
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 ml-7">
                            인쇄 횟수, 사용 통계 등을 DB에 기록하여 실시간 모니터링 가능
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-green-600 shrink-0 ml-4">
                          무료
                        </span>
                      </div>
                    </button>

                    {/* KSNET 결제 연동 */}
                    <div>
                      <button
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            useKsnetPayment: !prev.useKsnetPayment,
                            ksnetMerchantId: !prev.useKsnetPayment ? prev.ksnetMerchantId : "",
                          }))
                        }
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          form.useKsnetPayment
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                  form.useKsnetPayment
                                    ? "bg-purple-600 border-purple-600"
                                    : "border-gray-300"
                                }`}
                              >
                                {form.useKsnetPayment && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="font-medium">KSNET 결제 시스템 연동</span>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                결제
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1 ml-7">
                              KSNET 실결제 연동, 카드 결제 테스트 및 검증, 실결제 환경 적용
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-purple-600 shrink-0 ml-4">
                            {formatKRW(KSNET_PRICE)}원
                          </span>
                        </div>
                      </button>
                      {form.useKsnetPayment && (
                        <div className="mt-2 ml-7">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            KSNET 가맹점번호
                          </label>
                          <input
                            type="text"
                            value={form.ksnetMerchantId}
                            onChange={(e) => setForm((prev) => ({ ...prev, ksnetMerchantId: e.target.value }))}
                            placeholder="가맹점번호를 입력해주세요 (없으면 비워두세요)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            가맹점번호가 없는 경우 개발 시 별도 안내드립니다
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  기타 요청사항
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  rows={4}
                  placeholder="추가 요청사항을 자유롭게 적어주세요"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* 참고 자료 첨부 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  참고 자료 첨부
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  거래처와의 대화 캡쳐, 음성 파일, 참고 이미지 등을 첨부해주시면 더 정확한 견적이 가능합니다.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.webm"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-4 h-4" />
                      파일 선택 (이미지, 음성, 문서 / 최대 20MB)
                    </>
                  )}
                </button>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, i) => (
                      <div
                        key={file.fileName}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(file.mimeType)}
                          <span className="text-sm truncate">{file.originalName}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeAttachment(i)}
                          className="p-1 text-gray-400 hover:text-red-500 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: 미리보기 */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">견적 미리보기</h2>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">기본 정보</h3>
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between sm:block">
                      <dt className="text-gray-500">행사명</dt>
                      <dd className="font-medium">{form.eventName}</dd>
                    </div>
                    {form.eventDate && (
                      <div className="flex justify-between sm:block">
                        <dt className="text-gray-500">행사일</dt>
                        <dd className="font-medium">
                          {form.eventDate}
                          {form.eventEndDate && ` ~ ${form.eventEndDate}`}
                        </dd>
                      </div>
                    )}
                    {form.venue && (
                      <div className="flex justify-between sm:block">
                        <dt className="text-gray-500">장소</dt>
                        <dd className="font-medium">{form.venue}</dd>
                      </div>
                    )}
                    {form.deadline && (
                      <div className="flex justify-between sm:block">
                        <dt className="text-gray-500">납기일</dt>
                        <dd className="font-medium">{form.deadline}</dd>
                      </div>
                    )}
                    <div className="flex justify-between sm:block">
                      <dt className="text-gray-500">요청자</dt>
                      <dd className="font-medium">{form.requesterName}</dd>
                    </div>
                    {form.requesterContact && (
                      <div className="flex justify-between sm:block">
                        <dt className="text-gray-500">연락처</dt>
                        <dd className="font-medium">{form.requesterContact}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">견적 항목</h3>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-gray-500 font-medium">항목</th>
                        <th className="text-right py-2 text-gray-500 font-medium">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedModuleData.map((mod) => (
                        <tr key={mod.code} className="border-b border-gray-100">
                          <td className="py-2">{mod.name}</td>
                          <td className="py-2 text-right">
                            {mod.code === "AI_STYLE" && mod.basePrice === 0 ? (
                              <span className="text-orange-600 font-medium">협의</span>
                            ) : (
                              `${formatKRW(mod.basePrice)}원`
                            )}
                          </td>
                        </tr>
                      ))}
                      {form.screenComposition.includes("select_print") && (
                        <tr className="border-b border-gray-100">
                          <td className="py-2">선택 인쇄 기능</td>
                          <td className="py-2 text-right">{formatKRW(SELECT_PRINT_PRICE)}원</td>
                        </tr>
                      )}
                      {form.useKsnetPayment && (
                        <tr className="border-b border-gray-100">
                          <td className="py-2">
                            KSNET 결제 시스템 연동
                            {form.ksnetMerchantId && (
                              <span className="text-xs text-gray-400 ml-2">
                                (가맹점: {form.ksnetMerchantId})
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right">{formatKRW(KSNET_PRICE)}원</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-b">
                        <td className="py-2 text-gray-500">소계</td>
                        <td className="py-2 text-right">{formatKRW(subtotal)}원</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 text-gray-500">VAT (10%)</td>
                        <td className="py-2 text-right">{formatKRW(vat)}원</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">합계 (VAT 포함)</td>
                        <td className="py-2 text-right font-bold text-blue-600 text-lg">
                          {formatKRW(total)}원
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>

                {(form.screenDevice || form.printerType || form.networkType || form.screenComposition.length > 0 || form.useDbLogging || form.useKsnetPayment || form.notes) && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">상세 옵션</h3>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {form.screenDevice && (
                        <div>
                          <dt className="text-gray-500">스크린 기기</dt>
                          <dd className="font-medium">
                            {SCREEN_DEVICES.find((d) => d.value === form.screenDevice)?.label}
                          </dd>
                        </div>
                      )}
                      {form.screenResolution && (
                        <div>
                          <dt className="text-gray-500">해상도</dt>
                          <dd className="font-medium">{form.screenResolution}</dd>
                        </div>
                      )}
                      {form.screenComposition.length > 0 && (
                        <div className="sm:col-span-2">
                          <dt className="text-gray-500">화면 구성</dt>
                          <dd className="font-medium">
                            {form.screenComposition
                              .map((v) => SCREEN_FLOWS.find((s) => s.value === v)?.label)
                              .join(" → ")}
                          </dd>
                        </div>
                      )}
                      {form.printerType && (
                        <div>
                          <dt className="text-gray-500">프린터</dt>
                          <dd className="font-medium">{form.printerType}</dd>
                        </div>
                      )}
                      {form.networkType && (
                        <div>
                          <dt className="text-gray-500">네트워크</dt>
                          <dd className="font-medium">
                            {NETWORKS.find((n) => n.value === form.networkType)?.label}
                          </dd>
                        </div>
                      )}
                      {form.useDbLogging && (
                        <div>
                          <dt className="text-gray-500">서비스</dt>
                          <dd className="font-medium text-green-600">DB 직접 연결 로그 (무료)</dd>
                        </div>
                      )}
                      {form.useKsnetPayment && (
                        <div>
                          <dt className="text-gray-500">결제 연동</dt>
                          <dd className="font-medium text-purple-600">
                            KSNET 결제{form.ksnetMerchantId && ` (가맹점: ${form.ksnetMerchantId})`}
                          </dd>
                        </div>
                      )}
                      {form.notes && (
                        <div className="sm:col-span-2">
                          <dt className="text-gray-500">기타 요청</dt>
                          <dd className="font-medium whitespace-pre-wrap">{form.notes}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      첨부 파일 ({attachments.length}개)
                    </h3>
                    <div className="space-y-1.5">
                      {attachments.map((file) => (
                        <div key={file.fileName} className="flex items-center gap-2 text-sm">
                          {getFileIcon(file.mimeType)}
                          <span>{file.originalName}</span>
                          <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              이전
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                다음
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? "제출 중..." : "견적 요청 제출"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
