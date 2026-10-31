import { MODULE_GUIDE } from "@/lib/moduleGuide";

// 기능 카드 본문 — 사업팀용 안내(고객 언어) + 견적서에 찍히는 항목명
export function ModuleGuideText({
  code,
  name,
  description,
  badge,
}: {
  code: string;
  name: string;
  description: string | null;
  badge?: React.ReactNode;
}) {
  const guide = MODULE_GUIDE[code];

  if (!guide) {
    return (
      <>
        <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
          {name}
          {badge}
        </div>
        {description && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>}
      </>
    );
  }

  return (
    <>
      <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
        {guide.title}
        {badge}
      </div>
      <p className="text-xs text-gray-600 mt-0.5 leading-snug">{guide.when}</p>
      {guide.example && <p className="text-xs text-gray-500 mt-0.5 leading-snug">예: {guide.example}</p>}
      {guide.note && <p className="text-xs text-amber-700 mt-0.5 leading-snug">{guide.note}</p>}
      <p className="text-[11px] text-gray-400 mt-1">견적서 표기: {name}</p>
    </>
  );
}
