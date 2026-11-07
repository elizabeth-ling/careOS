import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

const ROLES = [
  { to: "/family", label: "Family view" },
  { to: "/nurse", label: "Nurse view" },
] as const;

/** Segmented control that moves between the family and nurse views. */
/** `touch` gives the family view's 44px touch targets. */
export function RoleSwitcher({ className, size = "default" }: { className?: string; size?: "default" | "touch" }) {
  return (
    <nav
      aria-label="Switch view"
      className={cn("inline-flex items-center gap-1 rounded-panel border border-border bg-sage-50 p-1", className)}
    >
      {ROLES.map((role) => (
        <NavLink
          key={role.to}
          to={role.to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center rounded-control border px-3",
              size === "touch" ? "h-11 text-[15px]" : "h-8 text-sm",
              "font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-border bg-surface text-ink"
                : "border-transparent text-brand-deep hover:bg-sage-100",
            )
          }
        >
          {role.label}
        </NavLink>
      ))}
    </nav>
  );
}
