"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Copy, Download, PackageOpen, RotateCw, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page";
import { errorMessage, isApiError } from "@/lib/api/client";
import { fetchFreshDownloadUrl, useAppRelease, type AppReleaseInfo } from "@/lib/api/hooks";
import { canSeeAppRelease, formatBytes, formatPublished, isAllowedDownloadUrl, truncateSha } from "@/lib/app-release/format";
import { useWorkspace } from "@/lib/workspace";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";

const STEPS = [
  "On your Android phone, open this page (or the link you were sent) and tap Download APK.",
  "When Android asks, allow installs from your browser. You only do this once.",
  "Open the downloaded file and tap Install.",
];

export function AndroidAppView() {
  const router = useRouter();
  const { workspaceId, role, meStatus } = useWorkspace();
  const allowed = canSeeAppRelease(role);
  const release = useAppRelease(workspaceId, allowed);

  // Guests never see this screen and the endpoint is never requested for them.
  const isGuest = meStatus === "success" && role !== undefined && !allowed;
  useEffect(() => {
    if (isGuest) router.replace("/settings");
  }, [isGuest, router]);
  if (isGuest) return null;

  const notPublished = isApiError(release.error) && release.error.status === 404;
  const loading = !allowed || (release.isPending && !release.isError);

  return (
    <>
      <PageHeader title="Get the Android app" description="Install AheadOne on your Android phone. It is not on the Play Store." />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {loading ? (
          <ReleaseSkeleton />
        ) : notPublished ? (
          <section className="rounded-md border border-border bg-surface">
            <EmptyState
              icon={PackageOpen}
              title="No app build has been published yet"
              description="Check back once the team publishes the first Android build."
            />
          </section>
        ) : release.isError && release.data === undefined ? (
          <section className="rounded-md border border-border bg-surface">
            <EmptyState
              compact
              tone="danger"
              icon={CircleAlert}
              title="Couldn't load the latest app"
              description={errorMessage(release.error)}
              action={
                <Button size="sm" onClick={() => void release.refetch()} loading={release.isFetching}>
                  <RotateCw aria-hidden /> Retry
                </Button>
              }
            />
          </section>
        ) : release.data && workspaceId ? (
          <ReleaseCard release={release.data} workspaceId={workspaceId} />
        ) : (
          <ReleaseSkeleton />
        )}
        <InstallSteps />
      </div>
    </>
  );
}

function ReleaseCard({ release, workspaceId }: { release: AppReleaseInfo; workspaceId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      // A fresh signed link on every click, so the 15 minute window is always full. Never stored or logged.
      const url = await fetchFreshDownloadUrl(qc, workspaceId);
      if (!isAllowedDownloadUrl(url)) {
        toast.error("Couldn't start the download", {
          description: "The download link wasn't from our file storage, so it was blocked.",
        });
        return;
      }
      window.location.assign(url);
    } catch (e) {
      if (isApiError(e) && e.code === "rate_limited") {
        toast.error("Too many download attempts", { description: "Wait a minute, then try again." });
      } else if (isApiError(e) && e.status === 404) {
        toast.error("No app build is published right now");
      } else {
        toast.error("Couldn't start the download", { description: errorMessage(e) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="release-h" className="flex flex-col rounded-md border border-border bg-surface">
      <div className="flex items-start gap-3 border-b border-border-subtle p-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-active text-fg">
          <Smartphone className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="release-h" className="flex flex-wrap items-center gap-2 text-16 font-semibold text-fg">
            Version {release.version_name}
            <Badge tone="neutral">Build {release.version_code}</Badge>
          </h2>
          <p className="text-12 text-fg-muted">
            Published {formatPublished(release.updated_at)} <span aria-hidden>·</span> {formatBytes(release.size_bytes)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <div>
          <h3 className="text-12 font-medium text-fg-muted">Release notes</h3>
          {release.notes?.trim() ? (
            <p className="mt-1 whitespace-pre-wrap text-13 text-fg">{release.notes}</p>
          ) : (
            <p className="mt-1 text-13 text-fg-muted">No notes for this version.</p>
          )}
        </div>

        <div>
          <h3 className="text-12 font-medium text-fg-muted">SHA-256</h3>
          <Sha256 value={release.sha256} />
        </div>

        <div className="flex flex-col items-start gap-2">
          <Button variant="primary" size="lg" onClick={() => void download()} loading={busy} aria-busy={busy}>
            <Download aria-hidden /> Download APK
          </Button>
          <p className="text-12 text-fg-muted">For Android phones only. The link is created when you tap the button.</p>
        </div>
      </div>
    </section>
  );
}

function Sha256({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
    }
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <code title={value} className="min-w-0 truncate rounded-xs bg-surface-sunken px-2 py-1 font-mono text-12 text-fg tabular">
        {truncateSha(value)}
      </code>
      <Button variant="secondary" size="sm" onClick={() => void copy()} aria-label="Copy SHA-256">
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <span className="sr-only" role="status">
        {copied ? "SHA-256 copied" : ""}
      </span>
    </div>
  );
}

function InstallSteps() {
  return (
    <section aria-labelledby="install-h" className="self-start rounded-md border border-border bg-surface p-4">
      <h2 id="install-h" className="text-14 font-semibold text-fg">
        How to install
      </h2>
      <ol className="mt-3 flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3 text-13 text-fg">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-active text-12 font-semibold tabular text-fg">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-border-subtle pt-3 text-13 text-fg-muted">
        After that, the app updates itself. You get a notification when a new version is ready, and you can update from the
        update screen inside the app.
      </p>
      <p className="mt-2 text-12 text-fg-muted">This build is for Android phones only.</p>
    </section>
  );
}

function ReleaseSkeleton() {
  return (
    <section className="rounded-md border border-border bg-surface" role="status" aria-label="Loading latest app">
      <div className="flex items-start gap-3 border-b border-border-subtle p-4">
        <Skeleton className="size-10 rounded-md" />
        <div className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
    </section>
  );
}
