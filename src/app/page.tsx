import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

// 첫 화면 = "내 차례" 홈. 기존 메뉴 카드(견적 요청·견적 관리·단가표)는 대시보드 헤더로 옮겼다.
export default async function RootPage() {
  const user = await getAuthUser();
  redirect(user ? "/dashboard/home" : "/login");
}
