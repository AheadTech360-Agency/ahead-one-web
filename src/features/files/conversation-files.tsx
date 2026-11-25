"use client";

import { CircleAlert, FolderOpen } from "lucide-react";
import { useMemo } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Conversation } from "@/lib/api/types";
import { EMPTY_FILTERS } from "@/lib/files/files-query";
import { formatBytes } from "@/lib/files/limits";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Sheet, SheetContent } from "@/ui/sheet";
import { Skeleton } from "@/ui/skeleton";
import { conversationLabel } from "../messages/format";
import { relativeTime } from "../tasks/lib/dates";
import { useFiles } from "./api";
import { useFileActions } from "./file-actions";
import { FileMenu } from "./file-views";
import { ExpiryBadge, FileTypeTile, RecordingMeta } from "./parts";

/** Every file shared in one channel or DM, newest first. Only members can open it (the API enforces this). */
export function ConversationFiles({ c, open, onOpenChange }: { c: Conversation; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { workspaceId, me } = useWorkspace();
  const filters = useMemo(() => ({ ...EMPTY_FILTERS, conversationId: c.id }), [c.id]);
  const files = useFiles(workspaceId, filters, open && c.is_member);
  const { actions, dialogs } = useFileActions();
  const items = (files.data?.pages ?? []).flat();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Files" description={`Shared in ${conversationLabel(c, me?.user.id)}`}>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" data-testid="conversation-files">
          {files.isPending ? (
            <div role="status" aria-label="Loading files" className="flex flex-col gap-2 pt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (files.isError && files.data === undefined) ? (
            <EmptyState
              compact
              tone="danger"
              icon={CircleAlert}
              title="Files didn't load"
              description={errorMessage(files.error)}
              action={<Button onClick={() => void files.refetch()}>Try again</Button>}
            />
          ) : items.length === 0 ? (
            <EmptyState compact icon={FolderOpen} title="No files here yet" description="Files shared in this conversation will be listed here." />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {items.map((f) => (
                  <li key={f.attachment.id} className="flex items-center gap-3 py-2.5">
                    <FileTypeTile a={f.attachment} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => actions.open(f.attachment)}
                        className="block max-w-full truncate rounded-xs text-left text-13 font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {f.attachment.filename}
                      </button>
                      <p className="flex flex-wrap items-center gap-x-2 text-12 text-fg-muted tabular">
                        <span>
                          {f.attachment.uploader?.full_name || "Someone"}, {relativeTime(f.attachment.created_at)}, {formatBytes(f.attachment.size_bytes)}
                        </span>
                        <RecordingMeta a={f.attachment} />
                        <ExpiryBadge expiresAt={f.expires_at} />
                      </p>
                    </div>
                    <FileMenu f={f} actions={actions} />
                  </li>
                ))}
              </ul>
              {files.hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button onClick={() => void files.fetchNextPage()} loading={files.isFetchingNextPage}>
                    Load more files
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {dialogs}
      </SheetContent>
    </Sheet>
  );
}
