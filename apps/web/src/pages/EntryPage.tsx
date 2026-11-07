import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/** `/`: pick a side of the demo. */
export function EntryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <ConnectionBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-card border border-border bg-surface px-8 py-10 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-page-title font-normal text-ink">Professional support for families caring at home</h1>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild className="h-11 w-full">
              <Link to="/family">
                Continue as family
                <ChevronRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link to="/nurse">
                Continue as nurse
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
