import { Link, Outlet } from "react-router";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Logo } from "@/components/Logo";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoIdentity } from "@/demo";
import { firstNameOf, initialsOf } from "@/lib/format";

function Account() {
  const identity = useDemoIdentity();
  const caregiver = identity.data?.caregiver;
  const patient = identity.data?.patient;

  if (!caregiver || !patient) {
    return (
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="hidden h-8 w-28 sm:block" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-9">
        <AvatarFallback>{initialsOf(caregiver.name)}</AvatarFallback>
      </Avatar>
      <div className="hidden leading-tight sm:block">
        <p className="text-sm font-semibold text-ink">{caregiver.name}</p>
        <p className="text-xs text-muted-foreground">Caring for {firstNameOf(patient.name)}</p>
      </div>
    </div>
  );
}

/** Logo, role switcher and account on top; centred content below. No nav links. */
export function FamilyLayout() {
  return (
    <div className="min-h-screen bg-canvas text-base">
      <ConnectionBanner />
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-7">
        <Link to="/family" className="rounded-panel" aria-label="CareOS family home">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <RoleSwitcher size="touch" />
          <Account />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1000px] px-4 py-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
