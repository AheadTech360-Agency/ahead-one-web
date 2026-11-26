import { Clock, FolderOpen } from "lucide-react";
import Link from "next/link";
import type { FilesSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatBytes, formatCount } from "../lib/logic";

/** Files in scope: how many, how much space, and what is about to expire. */
export function FilesSummaryStrip({ files }: { files: FilesSummary }) {
  return (
    <section aria-label="Files" className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-md border border-border bg-surface px-4 py-3.5">
      <h2 className="flex items-center gap-2 text-13 font-semibold text-fg">
        <FolderOpen className="size-4 text-fg-muted" strokeWidth={1.75} aria-hidden /> Files
      </h2>
      <dl className="m-0 flex flex-1 flex-wrap gap-x-8 gap-y-2">
        <Fig label="Files" value={formatCount(files.count)} />
        <Fig label="Stored" value={formatBytes(files.total_bytes)} />
        <Fig
          label="Expiring soon"
          value={formatCount(files.expiring_soon)}
          tone={files.expiring_soon > 0 ? "warn" : undefined}
          hint={files.expiring_soon > 0 ? "within 14 days" : "nothing to rescue"}
        />
      </dl>
      <Link href="/files" className="text-12 font-semibold text-fg underline decoration-2 underline-offset-4 hover:decoration-green">
        Open Files
      </Link>
    </section>
  );
}

function Fig({ label, value, tone, hint }: { label: string; value: string; tone?: "warn"; hint?: string }) {
  return (
    <div>
      <dt className="text-12 text-fg-muted">{label}</dt>
      <dd className={cn("figure m-0 flex items-center gap-1.5 text-[20px] font-medium leading-7 tracking-[-0.02em] tabular", tone === "warn" ? "text-warning-text" : "text-fg")}>
        {tone === "warn" && <Clock className="size-4" aria-hidden />}
        {value}
        {hint && <span className="text-12 font-normal tracking-normal text-fg-muted">{hint}</span>}
      </dd>
    </div>
  );
}
