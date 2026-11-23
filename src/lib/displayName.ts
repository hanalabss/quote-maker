// 이름 표시 규칙
//   dev 계정(개발팀장)의 직함 라벨은 "개발팀장".
//   사업팀(외부)이 볼 때 dev 계정은 실명 대신 "개발팀장"으로 보인다.
//   단, 그 사람이 해당 견적의 개발 담당자면 실명 그대로 (개발 담당 표기는 누구에게나 실명).

export const DEV_LEAD_LABEL = "개발팀장";

export function displayUserName(
  user: { name: string; role?: string | null },
  viewerRole: string | null | undefined,
  isAssignee = false,
): string {
  if (viewerRole === "sales" && user.role === "dev" && !isAssignee) return DEV_LEAD_LABEL;
  return user.name;
}
