import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons shown to the right of the title. */
  actions?: ReactNode;
  /** "greeting" is the family home's larger 44px title. */
  size?: "page" | "greeting";
  className?: string;
}

/** Page titles are always weight 400, never bold. */
export function PageTitle({ title, subtitle, actions, size = "page", className }: PageTitleProps) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className={cn("font-normal text-ink", size === "greeting" ? "text-greeting" : "text-page-title")}>
          {title}
        </h1>
        {subtitle && (
          <p className={cn("mt-1.5 text-body-2", size === "greeting" ? "text-base" : "text-sm")}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
