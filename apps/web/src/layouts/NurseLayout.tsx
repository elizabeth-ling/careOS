import {
  Activity,
  Bell,
  Calendar,
  ChevronsUpDown,
  FileText,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useQueue } from "@/api/hooks";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Logo } from "@/components/Logo";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_SHIFT, useDemoIdentity } from "@/demo";
import { formatHour, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  end?: boolean;
}

function NavItem({ to, icon: Icon, label, badge, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex h-10 items-center gap-3 rounded-panel px-3 text-[15px] transition-colors",
          isActive ? "bg-sage-50 font-medium text-brand-deep" : "text-ink hover:bg-table-head",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-[18px] shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-control px-1.5 text-xs font-semibold tabular-nums",
                isActive ? "bg-brand text-on-ink" : "bg-sage-50 text-muted-foreground",
              )}
            >
              {badge}
              <span className="sr-only"> {label === "Messages" ? "unread" : "unreviewed"}</span>
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function AccountBlock() {
  const identity = useDemoIdentity();
  const nurse = identity.data?.nurse;
  const careHome = identity.data?.careHome;

  if (!nurse || !careHome) {
    return (
      <div className="flex items-center gap-3 px-2 py-2">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    );
  }

  const displayName = `${nurse.name}, ${nurse.credentials}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-panel px-2 py-2 text-left hover:bg-table-head"
        >
          <Avatar className="size-10">
            <AvatarFallback>{initialsOf(nurse.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">{displayName}</span>
            <span className="block truncate text-[13px] text-muted-foreground">{careHome.name}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Account</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="text-sm">
        <p className="font-medium">{displayName}</p>
        <p className="text-muted-foreground">{careHome.name}</p>
        <p className="mt-2 text-muted-foreground">Demo account. Sign-in isn't part of the prototype.</p>
      </PopoverContent>
    </Popover>
  );
}

function Sidebar() {
  const queue = useQueue("all", "risk");
  const stats = queue.data?.stats;

  return (
    <aside
      aria-label="Nurse navigation"
      className="flex flex-col border-b border-border bg-surface px-2 py-5 min-[760px]:sticky min-[760px]:top-0 min-[760px]:h-screen min-[760px]:w-[272px] min-[760px]:shrink-0 min-[760px]:border-r min-[760px]:border-b-0"
    >
      <NavLink to="/nurse" className="mb-6 ml-2 self-start rounded-panel px-1" aria-label="CareOS triage queue">
        <Logo />
      </NavLink>

      <nav aria-label="Main" className="flex flex-col gap-1">
        <NavItem to="/nurse" end icon={Activity} label="Triage queue" badge={stats?.unreviewedCheckIns} />
        <NavItem to="/nurse/families" icon={Users} label="Families" />
        <NavItem to="/nurse/messages" icon={MessageSquare} label="Messages" badge={stats?.unreadFamilyMessages} />
        <NavItem to="/nurse/calls" icon={Calendar} label="Scheduled calls" />
        <NavItem to="/nurse/summaries" icon={FileText} label="Care summaries" />
      </nav>

      <div className="mt-6 flex flex-col gap-3 min-[760px]:mt-auto">
        <div className="rounded-panel border border-border bg-sage-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-deep uppercase">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            On shift
          </p>
          <p className="mt-0.5 text-[13px] text-body-2">
            {DEMO_SHIFT.nursesOnShift} nurses · {stats ? stats.counts.all : "–"} families · until{" "}
            {formatHour(DEMO_SHIFT.endsAtHour)}
          </p>
        </div>

        <NavItem to="/nurse/settings" icon={SlidersHorizontal} label="Settings" />
        <Separator />
        <AccountBlock />
      </div>
    </aside>
  );
}

function TopBar() {
  const queue = useQueue("all", "risk");
  const urgentWaiting = queue.data?.stats.urgentWaiting.length ?? 0;

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-7">
      <form role="search" className="relative min-w-0 flex-1 basis-60" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="nurse-search" className="sr-only">
          Search patients, families, notes
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="nurse-search"
          type="search"
          placeholder="Search patients, families, notes"
          className="h-10 w-full max-w-[420px] rounded-control border border-border bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted-foreground"
        />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <RoleSwitcher />
        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-control border border-border bg-surface text-ink hover:bg-sage-50"
        >
          <Bell className="size-[18px]" aria-hidden />
          <span className="sr-only">
            Notifications{urgentWaiting > 0 ? `, ${urgentWaiting} urgent waiting` : ""}
          </span>
          {urgentWaiting > 0 && (
            <span className="absolute top-2 right-2 size-2 rounded-full bg-urgent" aria-hidden />
          )}
        </button>
      </div>
    </header>
  );
}

/** Fixed sidebar on the left, top bar and content on the right. Stacks below 760px. */
export function NurseLayout() {
  return (
    <div className="min-h-screen bg-canvas text-sm">
      <div className="flex min-h-screen flex-col min-[760px]:flex-row">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <ConnectionBanner />
          <TopBar />
          <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-7">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
