import { Loader2 } from "lucide-react";

export default function CalendarLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );
}
