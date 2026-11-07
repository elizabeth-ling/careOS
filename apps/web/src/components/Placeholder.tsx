import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { PageTitle } from "./PageTitle";

/** Stand-in for a page that a later task builds. */
export function Placeholder({ title, task, children }: { title: string; task: number; children?: ReactNode }) {
  return (
    <>
      <PageTitle title={title} subtitle={`This page is built in Task ${task}.`} />
      <Card className="gap-2 px-6 py-6 text-body-2">
        <p>Coming soon.</p>
        {children}
      </Card>
    </>
  );
}
