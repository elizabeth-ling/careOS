import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

/** The CareOS mark: a 32px olive square with a white leaf, and the wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-panel bg-brand text-on-ink" aria-hidden>
        <Leaf className="size-4" />
      </span>
      <span className="text-[21px] font-bold tracking-tight text-ink">CareOS</span>
    </span>
  );
}
