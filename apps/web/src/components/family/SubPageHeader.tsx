import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { PageTitle } from "@/components/PageTitle";

/** "‹ Home" and a 34px title: the top of every family sub-page. */
export function SubPageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <>
      <Link
        to="/family"
        className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-1 rounded-control px-1 text-[15px] font-medium text-brand underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Home
      </Link>
      <PageTitle title={title} subtitle={subtitle} />
    </>
  );
}
