"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

interface Profile {
  id: string;
  loginId: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  team: string | null;
  position: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  dev: "개발팀",
  sales: "사업팀",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    team: "",
    position: "",
    password: "",
  });

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then((data: Profile) => {
        setProfile(data);
        setForm({
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          team: data.team || "",
          position: data.position || "",
          password: "",
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "수정에 실패했습니다");
        return;
      }
      const updated: Profile = await res.json();
      setProfile(updated);
      setForm((prev) => ({ ...prev, password: "" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-20 text-center text-gray-400">
        로그인이 필요합니다
      </div>
    );
  }

  const hasChanges =
    form.name !== profile.name ||
    form.email !== profile.email ||
    form.phone !== (profile.phone || "") ||
    form.team !== (profile.team || "") ||
    form.position !== (profile.position || "") ||
    form.password.length > 0;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">내 정보 수정</h1>
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-5">
        {/* 읽기 전용 정보 */}
        <div className="grid sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
          <div>
            <dt className="text-xs text-gray-500">아이디</dt>
            <dd className="text-sm font-medium font-mono">{profile.loginId}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">역할</dt>
            <dd className="text-sm font-medium">
              {ROLE_LABELS[profile.role] || profile.role}
            </dd>
          </div>
        </div>

        <hr />

        {/* 수정 가능한 필드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            이메일 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="email@example.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            전화번호
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="010-0000-0000"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              팀/부서
            </label>
            <input
              type="text"
              value={form.team}
              onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))}
              placeholder="예: 사업팀"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              직급
            </label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
              placeholder="예: 대리"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <hr />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            비밀번호 변경
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="변경할 비밀번호 입력 (변경 시에만)"
              className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            비워두면 기존 비밀번호가 유지됩니다
          </p>
        </div>

        {/* 저장 버튼 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.email.trim() || !hasChanges}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "저장 중..." : "저장"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              저장되었습니다
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
