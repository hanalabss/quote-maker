import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { kstToday } from "@/lib/lifecycle";
import { getNextAction, isMyTurn, actionPriority, ACTOR_LABELS, type NextAction } from "@/lib/nextAction";
import { STATUS_LABELS, STATUS_COLORS, type QuoteStatus } from "@/types";
import { ArrowRight, FilePlus2, Inbox, Hourglass } from "lucide-react";

// "내 차례" 홈 — 로그인 후 첫 화면. 견적마다 다음 행동 주체를 계산해 내 차례인 건을 먼저 보여준다.

interface HomeRow {
  id: string;
  quoteNumber: string;
  eventName: string;
  status: string;
  eventDate: string | null;
  confirmedDate: string | null;
  isExternal: boolean;
  createdByName: string | null;
  action: NextAction;
}

const TONE_CLASS: Record<NextAction["tone"], string> = {
  action: "text-blue-700",
  warn: "text-amber-700",
  wait: "text-gray-500",
  done: "text-gray-400",
};

function fmtShort(d: string | null) {
  if (!d) return "-";
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

function Row({ r, showOwner, showActor = false }: { r: HomeRow; showOwner: boolean; showActor?: boolean }) {
  const date = r.confirmedDate || r.eventDate;
  return (
    <li>
      <Link
        href={`/dashboard/quotes/${r.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 focus-visible:bg-gray-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{r.eventName}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status as QuoteStatus] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[r.status as QuoteStatus] ?? r.status}
            </span>
            {r.isExternal && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium text-purple-700 bg-purple-50">외주</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap">
            <span className="tabular-nums">{r.quoteNumber}</span>
            <span>행사 {fmtShort(date)}</span>
            {showOwner && r.createdByName && <span>요청 {r.createdByName}</span>}
          </div>
        </div>
        <div className={`text-sm font-medium text-right shrink-0 max-w-[45%] ${TONE_CLASS[r.action.tone]}`}>
          {showActor && r.action.actor ? `${ACTOR_LABELS[r.action.actor]} · ${r.action.label}` : r.action.label}
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function HomePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const where: Record<string, unknown> = { status: { notIn: ["lost"] } };
  if (user.role !== "dev") where.isExternal = false;
  if (user.role === "sales") {
    where.createdById = user.id;
    where.isHidden = false;
  }

  const quotes = await prisma.quote.findMany({
    where,
    select: {
      id: true,
      quoteNumber: true,
      eventName: true,
      status: true,
      eventDate: true,
      eventEndDate: true,
      confirmedDate: true,
      confirmedEndDate: true,
      devDeadline: true,
      devCompletedAt: true,
      depositPaidAt: true,
      balancePaidAt: true,
      isExternal: true,
      createdBy: { select: { name: true, role: true } },
      comments: { orderBy: { createdAt: "desc" }, take: 1, select: { user: { select: { role: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const today = kstToday();
  const rows: HomeRow[] = quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    eventName: q.eventName,
    status: q.status,
    eventDate: q.eventDate,
    confirmedDate: q.confirmedDate,
    isExternal: q.isExternal,
    createdByName: q.createdBy?.name ?? null,
    action: getNextAction(
      {
        ...q,
        devCompletedAt: q.devCompletedAt?.toISOString() ?? null,
        lastCommentRole: q.comments[0]?.user.role ?? null,
        createdByRole: q.createdBy?.role ?? null,
      },
      today
    ),
  }));

  // 단계 우선순위(경고 → 검토 → 개발 → 고객 전달 → 입금), 같은 단계는 행사일 가까운 순
  const byUrgency = (a: HomeRow, b: HomeRow) => {
    const pa = actionPriority(a.action, a.status);
    const pb = actionPriority(b.action, b.status);
    if (pa !== pb) return pa - pb;
    const da = a.confirmedDate || a.eventDate || "9999";
    const db = b.confirmedDate || b.eventDate || "9999";
    return da.localeCompare(db);
  };

  const mine = rows.filter((r) => isMyTurn(r.action, user.role, r)).sort(byUrgency);
  // 기다리는 중: 진행 중이지만 다른 주체 차례 (정산 완료·반려 등 끝난 건 제외)
  // 행사 완료 후 입금 기록은 관리(dev) 업무라 다른 role에게는 보이지 않는다
  const waiting = rows
    .filter(
      (r) =>
        !isMyTurn(r.action, user.role, r) &&
        r.action.tone !== "done" &&
        (user.role === "dev" || r.status !== "completed")
    )
    .sort(byUrgency);

  // 상단 요약: 내 차례 행동 라벨별 개수 (D-day 등 숫자가 붙은 라벨은 앞부분으로 묶음)
  const summary = new Map<string, number>();
  for (const r of mine) {
    const key = r.action.label.replace(/ · 납기 D-\d+$/, "").replace(/ \d+일 초과$/, " 초과");
    summary.set(key, (summary.get(key) ?? 0) + 1);
  }

  const showOwner = user.role !== "sales";
  const canRequest = user.role === "sales" || user.role === "dev";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {mine.length > 0 ? `${user.name}님 차례 ${mine.length}건` : `${user.name}님 차례인 견적이 없습니다`}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mine.length > 0 ? "급한 순서로 정렬했습니다. 행을 누르면 해당 견적으로 이동합니다." : "다른 팀이나 고객사의 회신을 기다리는 견적만 있습니다."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/quotes" className="text-sm px-3 py-2 border rounded-lg hover:bg-gray-50 bg-white">
            전체 견적
          </Link>
          {canRequest && (
            <Link href="/request" className="text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
              <FilePlus2 className="w-4 h-4" />
              새 견적 요청
            </Link>
          )}
        </div>
      </div>

      {summary.size > 0 && (
        <ul className="flex gap-2 flex-wrap" aria-label="내 차례 요약">
          {[...summary.entries()].map(([label, n]) => (
            <li key={label} className="text-sm bg-white border rounded-full px-3 py-1">
              {label} <b className="tabular-nums">{n}</b>
            </li>
          ))}
        </ul>
      )}

      <section className="bg-white border rounded-xl overflow-hidden" aria-labelledby="mine-title">
        <h2 id="mine-title" className="px-4 py-3 border-b font-semibold flex items-center gap-2">
          <Inbox className="w-4 h-4 text-blue-600" />
          내 차례
        </h2>
        {mine.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500 text-center">지금 처리할 견적이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {mine.map((r) => (
              <Row key={r.id} r={r} showOwner={showOwner} />
            ))}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <details className="bg-white border rounded-xl overflow-hidden group">
          <summary className="px-4 py-3 font-semibold flex items-center gap-2 cursor-pointer select-none">
            <Hourglass className="w-4 h-4 text-gray-400" />
            기다리는 중 <span className="text-gray-500 font-normal tabular-nums">{waiting.length}</span>
            <span className="text-xs text-gray-400 font-normal ml-auto">
              {(["dev", "sales", "client"] as const)
                .map((a) => [ACTOR_LABELS[a], waiting.filter((r) => r.action.actor === a).length] as const)
                .filter(([, n]) => n > 0)
                .map(([l, n]) => `${l} ${n}`)
                .join(" · ")}
            </span>
          </summary>
          <ul className="divide-y border-t">
            {waiting.map((r) => (
              <Row key={r.id} r={r} showOwner={showOwner} showActor />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
