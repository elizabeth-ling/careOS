import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps every AI-generated block. The label is required by the safety rules
 * in CLAUDE.md: "AI summary · verify against transcript".
 */
export function AiSummaryPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section aria-label="AI summary" className={cn("rounded-panel bg-sage-50 px-5 py-4", className)}>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-deep uppercase">
        <Sparkles className="size-3.5" aria-hidden />
        AI summary · verify against transcript
      </p>
      <div className="text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}
