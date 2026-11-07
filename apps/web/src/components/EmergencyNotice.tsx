import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmergencyNoticeProps {
  /**
   * "alert": the red call-911 banner, shown whenever a check-in contains
   * emergency terms (it must always show; see CLAUDE.md).
   * "reminder": the quiet standing line under the family home.
   */
  variant?: "alert" | "reminder";
  className?: string;
}

export function EmergencyNotice({ variant = "alert", className }: EmergencyNoticeProps) {
  if (variant === "reminder") {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-body-2", className)}>
        <TriangleAlert className="size-4 shrink-0 text-urgent" aria-hidden />
        In an emergency, call 911. For health advice any time, call Health811.
      </p>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-panel border border-urgent/30 bg-urgent-bg px-4 py-3 text-urgent",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="text-[15px] font-semibold">This may be an emergency. Call 911 now.</p>
        <p className="text-sm">
          The check-in mentions symptoms that need urgent help. Don't wait for a nurse to reply.
        </p>
      </div>
    </div>
  );
}
