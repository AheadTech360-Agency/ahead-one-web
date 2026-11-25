"use client";

import { CircleAlert, FileSearch, FolderOpen, LayoutGrid, List, Search, Video, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useMembers } from "@/lib/api/hooks";
import { filtersFromParams, hasActiveFilters, paramsFromFilters, type FileFilters, TYPES } from "@/lib/files/files-query";
import { formatBytes } from "@/lib/files/limits";
import { useStoredState } from "@/lib/hooks/use-stored-state";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconButton } from "@/ui/icon-button";
import { Input } from "@/ui/input";
import { Select } from "@/ui/select";
import { Skeleton } from "@/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { RecordButton } from "../recorder/record-button";
import { ScreenFrame, ScreenHeader } from "../tasks/screens/screen-frame";
import { useFiles, useFilesSummary } from "./api";
import { useFileActions } from "./file-actions";
import { FileCard, FileRow, FilesHeader } from "./file-views";

const ALL = "all";
const SOURCE_TABS = [
  { value: ALL, label: "All files" },
  { value: "tasks", label: "Tasks" },
  { value: "chats", label: "Chats" },
  { value: "recordings", label: "Recordings" },
] as const;
const TYPE_LABEL: Record<string, string> = { image: "Images", video: "Videos", audio: "Audio", document: "Documents", other: "Other" };

export function FilesScreen() {
  const { workspaceId } = useWorkspace();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [view, setView] = useStoredState<"list" | "grid">("ahead-one.files-view", "list");
  const members = useMembers(workspaceId);
  const summary = useFilesSummary(workspaceId);
  const files = useFiles(workspaceId, filters);
  const { actions, dialogs } = useFileActions();

  const update = (patch: Partial<FileFilters>) => router.replace(`${pathname}${paramsFromFilters({ ...filters, ...patch })}`, { scroll: false });

  // Search is debounced into the URL so a filtered view can be shared.
  const [text, setText] = useState(filters.q);
  useEffect(() => {
    if (text.trim() === filters.q.trim()) return;
    const id = window.setTimeout(() => update({ q: text }), 300);
    return () => window.clearTimeout(id);
    // `update` closes over the current filters; re-running on text changes is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  // Keep the box in step when the URL changes elsewhere (Clear, back button).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q);
  }

  const items = useMemo(() => (files.data?.pages ?? []).flat(), [files.data]);
  const recordings = filters.source === "recordings";
  const cards = recordings || view === "grid";
  const active = hasActiveFilters(filters);
  const s = summary.data;

  return (
    <ScreenFrame>
      <ScreenHeader
        title="Files"
        meta={
          s ? (
            <>
              <span className="tabular">
                {s.count.toLocaleString()} {s.count === 1 ? "file" : "files"}, {formatBytes(s.total_bytes)}
              </span>
              {s.expiring_soon > 0 && (
                <span className="font-medium text-warning-text tabular">{s.expiring_soon} expiring soon</span>
              )}
            </>
          ) : undefined
        }
        actions={<RecordButton size="md" />}
      />

      <Tabs value={filters.source || ALL} onValueChange={(v) => update({ source: v === ALL ? "" : (v as FileFilters["source"]) })}>
        <TabsList aria-label="Where files come from">
          {SOURCE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.value === "recordings" && <Video className="size-3.5" aria-hidden />}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter files">
        <div className="w-full sm:w-64">
          <Input
            type="search"
            aria-label="Search files by name"
            placeholder="Search file names"
            leading={<Search aria-hidden />}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Select
          aria-label="File type"
          className="w-36"
          value={filters.type || ALL}
          onValueChange={(v) => update({ type: v === ALL ? "" : (v as FileFilters["type"]) })}
          options={[{ value: ALL, label: "All types" }, ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]}
        />
        <Select
          aria-label="Uploaded by"
          className="w-44"
          value={filters.uploader || ALL}
          onValueChange={(v) => update({ uploader: v === ALL ? "" : v })}
          options={[
            { value: ALL, label: "Anyone" },
            ...(members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.full_name || m.user.email })),
          ]}
        />
        {active && (
          <Button size="sm" variant="ghost" onClick={() => router.replace(`${pathname}${paramsFromFilters({ q: "", type: "", uploader: "", source: filters.source })}`, { scroll: false })}>
            <X aria-hidden /> Clear filters
          </Button>
        )}
        <div className={cn("ml-auto flex items-center gap-0.5", recordings && "hidden")} role="group" aria-label="Layout">
          <IconButton label="List view" size="sm" aria-pressed={view === "list"} className={view === "list" ? "bg-active text-fg" : undefined} onClick={() => setView("list")}>
            <List aria-hidden />
          </IconButton>
          <IconButton label="Grid view" size="sm" aria-pressed={view === "grid"} className={view === "grid" ? "bg-active text-fg" : undefined} onClick={() => setView("grid")}>
            <LayoutGrid aria-hidden />
          </IconButton>
        </div>
      </div>

      <div aria-live="polite" aria-busy={files.isFetching}>
        {files.isPending ? (
          <FilesSkeleton cards={cards} />
        ) : files.isError ? (
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="Files didn't load"
            description={errorMessage(files.error)}
            action={<Button onClick={() => void files.refetch()}>Try again</Button>}
          />
        ) : items.length === 0 ? (
          active ? (
            <EmptyState
              icon={FileSearch}
              title="No files match"
              description="Try a different name or clear a filter."
              action={<Button onClick={() => { setText(""); router.replace(`${pathname}${paramsFromFilters({ q: "", type: "", uploader: "", source: filters.source })}`, { scroll: false }); }}>Clear filters</Button>}
            />
          ) : recordings ? (
            <EmptyState
              icon={Video}
              title="No recordings yet"
              description="Record your screen to show a bug or walk someone through a task. Recordings stay private until you attach them to a task."
              action={<RecordButton size="md" variant="secondary" />}
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title={filters.source ? "Nothing here yet" : "No files yet"}
              description="Files attached to tasks, comments and messages show up here, along with your screen recordings."
            />
          )
        ) : (
          <>
            {cards ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((f) => (
                  <FileCard key={f.attachment.id} f={f} actions={actions} />
                ))}
              </ul>
            ) : (
              <>
                <FilesHeader />
                <ul className="flex flex-col divide-y divide-border-subtle">
                  {items.map((f) => (
                    <FileRow key={f.attachment.id} f={f} actions={actions} />
                  ))}
                </ul>
              </>
            )}
            <div className="flex items-center justify-center gap-3 py-6 text-12 text-fg-muted">
              {files.hasNextPage ? (
                <Button onClick={() => void files.fetchNextPage()} loading={files.isFetchingNextPage}>
                  Load more files
                </Button>
              ) : (
                <span className="tabular">
                  {items.length} {items.length === 1 ? "file" : "files"} shown
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {dialogs}
    </ScreenFrame>
  );
}

function FilesSkeleton({ cards }: { cards: boolean }) {
  return (
    <div role="status" aria-label="Loading files">
      {cards ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-14 items-center gap-3 px-2">
              <Skeleton className="size-9" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="ml-auto h-3 w-1/4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
