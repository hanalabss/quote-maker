"use client";

import { useState } from "react";
import { MessageCircle, Edit3, Trash2, Send, Loader2, CornerDownRight, Lock, ArrowRightLeft } from "lucide-react";
import { looksLikePrice, visibleChannels, type CommentChannel } from "@/lib/quoteAccess";

export interface QuoteCommentType {
  id: string;
  userId: string;
  content: string;
  visibility: CommentChannel;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: { name: string; role: string; team: string | null };
}

const CHANNEL_META: Record<CommentChannel, { label: string; hint: string }> = {
  quote: { label: "견적 협의", hint: "관리자·사업팀만 봅니다. 금액 이야기는 여기서." },
  dev: { label: "개발", hint: "개발 담당자도 봅니다. 금액은 적지 마세요." },
};

function roleBadge(role: string) {
  if (role === "dev") return { text: "개발팀", cls: "bg-blue-100 text-blue-700", box: "bg-blue-50 border-blue-100" };
  if (role === "dev_staff") return { text: "개발 담당", cls: "bg-indigo-100 text-indigo-700", box: "bg-indigo-50 border-indigo-100" };
  return { text: "사업팀", cls: "bg-gray-200 text-gray-600", box: "bg-gray-50 border-gray-100" };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function QuoteComments({
  quoteId,
  comments,
  setComments,
  userId,
  role,
  defaultChannel,
}: {
  quoteId: string;
  comments: QuoteCommentType[];
  setComments: React.Dispatch<React.SetStateAction<QuoteCommentType[]>>;
  userId?: string;
  role?: string;
  defaultChannel: CommentChannel;
}) {
  const channels = visibleChannels(role);
  const isDev = role === "dev";
  const [tab, setTab] = useState<CommentChannel>(channels.includes(defaultChannel) ? defaultChannel : channels[0]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [saving, setSaving] = useState(false);

  const inTab = comments.filter((c) => c.visibility === tab);
  const roots = inTab.filter((c) => !c.parentId);
  const repliesOf = (id: string) => inTab.filter((c) => c.parentId === id);
  const countOf = (ch: CommentChannel) => comments.filter((c) => c.visibility === ch).length;

  // 개발 채널에 금액처럼 보이는 내용이면 한 번 확인 (차단 아님)
  function priceGuard(text: string, channel: CommentChannel) {
    if (channel !== "dev" || !looksLikePrice(text)) return true;
    return confirm("금액이 포함된 것 같습니다.\n개발 채널은 개발 담당자도 봅니다. 그대로 등록할까요?\n(취소 후 '견적 협의' 탭에 작성해주세요)");
  }

  async function post(content: string, parentId: string | null) {
    const channel = parentId ? (comments.find((c) => c.id === parentId)?.visibility ?? tab) : tab;
    if (!priceGuard(content, channel)) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentId ? { content, parentId } : { content, visibility: tab }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data]);
        return true;
      }
      alert(data.error || "댓글 등록에 실패했습니다");
    } catch (e) {
      console.error("댓글 등록 오류:", e);
    } finally {
      setSaving(false);
    }
    return false;
  }

  async function addRoot() {
    if (!newComment.trim()) return;
    if (await post(newComment, null)) setNewComment("");
  }

  async function addReply() {
    if (!replyTo || !replyText.trim()) return;
    if (await post(replyText, replyTo)) {
      setReplyText("");
      setReplyTo(null);
    }
  }

  async function update() {
    if (!editingId || !editingText.trim()) return;
    const target = comments.find((c) => c.id === editingId);
    if (target && !priceGuard(editingText, target.visibility)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingText }),
      });
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
        setEditingId(null);
        setEditingText("");
      }
    } catch (e) {
      console.error("댓글 수정 오류:", e);
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const n = comments.filter((c) => c.parentId === id).length;
    if (!confirm(n > 0 ? `댓글과 답글 ${n}개를 삭제하시겠습니까?` : "댓글을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}/comments/${id}`, { method: "DELETE" });
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id && c.parentId !== id));
    } catch (e) {
      console.error("댓글 삭제 오류:", e);
    }
  }

  // 관리자: 채널 이동 (개발 채널에 금액이 올라온 경우 등). 답글도 함께 이동
  async function move(id: string, to: CommentChannel) {
    if (!confirm(`'${CHANNEL_META[to].label}' 채널로 옮길까요? 답글도 함께 옮겨집니다.`)) return;
    const res = await fetch(`/api/quotes/${quoteId}/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: to }),
    });
    const data = await res.json();
    if (res.ok) {
      setComments((prev) => prev.map((c) => (c.id === id || c.parentId === id ? { ...c, visibility: to } : c)));
    } else alert(data.error || "채널 이동에 실패했습니다");
  }

  function renderComment(c: QuoteCommentType, isReply: boolean) {
    const b = roleBadge(c.user.role);
    const mine = c.userId === userId;
    return (
      <div key={c.id} className={`p-2.5 sm:p-3 rounded-lg border ${b.box}`}>
        <div className="flex items-center gap-x-2 gap-y-1 mb-1 flex-wrap">
          <span className="text-sm font-medium">{c.user.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${b.cls}`}>{b.text}</span>
          <span className="text-xs text-gray-400">
            {fmt(c.createdAt)}
            {new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 2000 && " (수정됨)"}
          </span>
          <span className="ml-auto flex items-center gap-1 sm:gap-1.5">
            {!isReply && editingId !== c.id && (
              <button
                onClick={() => {
                  setReplyTo(replyTo === c.id ? null : c.id);
                  setReplyText("");
                }}
                aria-expanded={replyTo === c.id}
                className="px-2 py-1 -my-1 rounded-md text-xs text-gray-500 hover:text-blue-600 hover:bg-white/70 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                답글
              </button>
            )}
            {isDev && !isReply && (
              <button
                onClick={() => move(c.id, c.visibility === "dev" ? "quote" : "dev")}
                className="p-1.5 -m-0.5 rounded-md text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 hover:text-amber-600 hover:bg-white/70 transition-colors"
                title={c.visibility === "dev" ? "견적 협의 채널로 이동" : "개발 채널로 이동"}
                aria-label={c.visibility === "dev" ? "견적 협의 채널로 이동" : "개발 채널로 이동"}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {mine && editingId !== c.id && (
              <button
                onClick={() => {
                  setEditingId(c.id);
                  setEditingText(c.content);
                }}
                className="p-1.5 -m-0.5 rounded-md text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 hover:text-blue-500 hover:bg-white/70 transition-colors"
                title="수정"
                aria-label="수정"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {(isDev || mine) && (
              <button onClick={() => remove(c.id)} className="p-1.5 -m-0.5 rounded-md text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 hover:text-red-500 hover:bg-white/70 transition-colors" title="삭제" aria-label="삭제">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </div>
        {editingId === c.id ? (
          <div>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  update();
                }
                if (e.key === "Escape") {
                  setEditingId(null);
                  setEditingText("");
                }
              }}
            />
            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditingText("");
                }}
                className="px-3 py-1.5 sm:px-2.5 sm:py-1 text-sm sm:text-xs text-gray-500 border rounded-lg hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={update}
                disabled={!editingText.trim() || saving}
                className="px-3 py-1.5 sm:px-2.5 sm:py-1 text-sm sm:text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.content}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5">
      <h3 className="font-medium mb-3 flex items-center gap-1.5">
        <MessageCircle className="w-4 h-4" />
        댓글 ({comments.length})
      </h3>

      {channels.length > 1 && (
        <div className="grid grid-cols-2 sm:flex sm:gap-1 mb-2 border-b" role="tablist">
          {channels.map((ch) => (
            <button
              key={ch}
              role="tab"
              aria-selected={tab === ch}
              onClick={() => {
                setTab(ch);
                setReplyTo(null);
              }}
              className={`px-3 py-2.5 sm:py-1.5 text-sm -mb-px border-b-2 transition-colors flex items-center justify-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                tab === ch ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {ch === "quote" && <Lock className="w-3 h-3" />}
              {CHANNEL_META[ch].label} ({countOf(ch)})
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mb-3">{CHANNEL_META[tab].hint}</p>

      {roots.length > 0 ? (
        <div className="space-y-3 mb-4">
          {roots.map((c) => (
            <div key={c.id}>
              {renderComment(c, false)}
              {(repliesOf(c.id).length > 0 || replyTo === c.id) && (
                <div className="mt-2 ml-2 pl-2 sm:ml-5 sm:pl-3 border-l-2 border-gray-200 space-y-2">
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="flex gap-1.5">
                      <CornerDownRight className="hidden sm:block w-3.5 h-3.5 text-gray-300 mt-3 shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">{renderComment(r, true)}</div>
                    </div>
                  ))}
                  {replyTo === c.id && (
                    <div className="flex gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`${c.user.name}님에게 답글...`}
                        rows={2}
                        autoFocus
                        className="flex-1 px-3 py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            addReply();
                          }
                          if (e.key === "Escape") setReplyTo(null);
                        }}
                      />
                      <button
                        onClick={addReply}
                        disabled={!replyText.trim() || saving}
                        className="self-end shrink-0 w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        aria-label="답글 등록"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
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
          placeholder={`${CHANNEL_META[tab].label} 채널에 댓글 입력...`}
          rows={2}
          className="flex-1 px-3 py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              addRoot();
            }
          }}
        />
        <button
          onClick={addRoot}
          disabled={!newComment.trim() || saving}
          className="self-end shrink-0 w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          aria-label="댓글 등록"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
