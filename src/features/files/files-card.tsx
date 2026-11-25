"use client";

import { CircleAlert, Clock, FolderOpen } from "lucide-react";
import Link from "next/link";
import { errorMessage } from "@/lib/api/client";
import { formatBytes } from "@/lib/files/limits";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { RecordButton } from "../recorder/record-button";
import { useFilesSummary } from "./api";

/** Home dashboard card: how much the workspace has stored, and what is about to be deleted. */
export function FilesCard({ className }: { className?: string }) {
  const { workspaceId } = useWorkspace();
  const q = useFilesSummary(workspaceId);
  const s = q.data;
  return (
    <section aria-label="Files" className={cn("flex flex-wrap items-center gap-x-8 gap-y-4 rounded-md bg-surface-sunken p-5", className)} data-testid="files-card">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-sm bg-surface text-fg-muted">
          <FolderOpen className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-16 font-semibold text-fg">Files</h2>
      </div>
      {q.isPending ? (
        <div role="status" aria-label="Loading files summary" className="flex flex-1 gap-8">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      ) : (q.isError && q.data === undefined) || !s ? (
        <p className="flex flex-1 items-center gap-2 text-13 text-fg-muted">
          <CircleAlert className="size-4 text-danger-text" aria-hidden /> {errorMessage(q.error)}
          <Button size="sm" variant="ghost" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </p>
      ) : (
        <dl className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-12 text-fg-muted">Files</dt>
            <dd className="figure text-[24px] font-medium leading-8 tracking-[-0.02em] text-fg tabular">{s.count.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-12 text-fg-muted">Stored</dt>
            <dd className="figure text-[24px] font-medium leading-8 tracking-[-0.02em] text-fg tabular">{formatBytes(s.total_bytes)}</dd>
          </div>
          <div>
            <dt className="text-12 text-fg-muted">Expiring soon</dt>
            <dd className={cn("figure flex items-center gap-1.5 text-[24px] font-medium leading-8 tracking-[-0.02em] tabular", s.expiring_soon ? "text-warning-text" : "text-fg-faint")}>
              {s.expiring_soon > 0 && <Clock className="size-4" aria-hidden />}
              {s.expiring_soon.toLocaleString()}
              <span className="text-12 font-normal tracking-normal text-fg-muted">{s.expiring_soon ? "within 14 days" : "nothing to rescue"}</span>
            </dd>
          </div>
        </dl>
      )}
      <div className="flex items-center gap-2">
        <RecordButton />
        <Button asChild size="sm" variant="secondary">
          <Link href="/files">Open Files</Link>
        </Button>
      </div>
    </section>
  );
}
