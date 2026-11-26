"use client";

import { Command } from "cmdk";
import {
  ArrowLeft,
  Bell,
  CheckSquare,
  CircleAlert,
  FileClock,
  FolderKanban,
  Home,
  Keyboard,
  MessagesSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Smartphone,
  Sun,
  Users,
  FolderOpen,
  Video,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { useTree } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { useRecorder } from "@/features/recorder/provider";
import { useSearch } from "@/features/tasks/api";
import { canSeeAppRelease } from "@/lib/app-release/format";
import { cn } from "@/lib/utils";
import { roleAtLeast, useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { PriorityBadge } from "@/ui/badge";
import { Kbd } from "@/ui/kbd";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { useShell } from "./shell-context";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const itemClass =
  "flex h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-13 text-fg outline-none " +
  "data-[selected=true]:bg-hover [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-fg-faint";

const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-12 [&_[cmdk-group-heading]]:text-fg-muted";

export function CommandPalette() {
  const { palette, setPaletteOpen, openPalette, setShortcutsOpen, setCreateTaskOpen } = useShell();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { workspaceId, role } = useWorkspace();
  const recorder = useRecorder();
  const tree = useTree(workspaceId);
  const [query, setQuery] = useState("");
  const mode = palette.mode;

  function close() {
    setPaletteOpen(false);
    setQuery("");
  }
  function go(href: string) {
    close();
    router.push(href);
  }

  const projects = (tree.data ?? []).flatMap((s) =>
    s.projects.map((p) => ({ ...p, spaceName: s.name })),
  );

  return (
    <DialogPrimitive.Root open={palette.open} onOpenChange={(o) => (o ? setPaletteOpen(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-overlay data-[state=open]:animate-in-fade" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[14vh] z-[var(--z-modal)] w-[calc(100vw-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden",
            "rounded-lg border border-border bg-surface-raised text-fg shadow-dialog outline-none data-[state=open]:animate-in-pop",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {mode === "search" ? "Search tasks" : "Command menu"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Type to filter. Use arrow keys to move and Enter to run.
          </DialogPrimitive.Description>
          {mode === "search" ? (
            <SearchMode
              query={query}
              setQuery={setQuery}
              onBack={() => {
                setQuery("");
                openPalette("commands");
              }}
              go={go}
            />
          ) : (
            <Command loop label="Command menu" className="flex flex-col">
              <div className="flex h-12 items-center gap-2.5 border-b border-border-subtle px-4">
                <Search className="size-4 text-fg-faint" aria-hidden />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Type a command or jump to a project"
                  className="h-full flex-1 bg-transparent text-14 text-fg outline-none placeholder:text-fg-faint"
                />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-8 text-center text-13 text-fg-muted">
                  No commands match. Press Enter in search mode to look through tasks.
                </Command.Empty>
                <Command.Group heading="Actions" className={groupClass}>
                  <Command.Item
                    className={itemClass}
                    onSelect={() => {
                      close();
                      setCreateTaskOpen(true);
                    }}
                  >
                    <Plus aria-hidden /> Create task
                    <Kbd className="ml-auto">C</Kbd>
                  </Command.Item>
                  <Command.Item
                    className={itemClass}
                    value="search tasks find"
                    onSelect={() => {
                      setQuery("");
                      openPalette("search");
                    }}
                  >
                    <Search aria-hidden /> Search tasks
                    <Kbd className="ml-auto">/</Kbd>
                  </Command.Item>
                  <Command.Item
                    className={itemClass}
                    value="toggle theme dark light mode appearance"
                    onSelect={() => {
                      setTheme(resolvedTheme === "dark" ? "light" : "dark");
                      close();
                    }}
                  >
                    {resolvedTheme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
                    Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                  </Command.Item>
                  <Command.Item
                    className={itemClass}
                    onSelect={() => {
                      close();
                      setShortcutsOpen(true);
                    }}
                  >
                    <Keyboard aria-hidden /> Keyboard shortcuts
                    <Kbd className="ml-auto">?</Kbd>
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Go to" className={groupClass}>
                  <Command.Item className={itemClass} onSelect={() => go("/")}>
                    <Home aria-hidden /> Home
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go("/my-tasks")}>
                    <CheckSquare aria-hidden /> My tasks
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go("/inbox")}>
                    <Bell aria-hidden /> Inbox
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go("/files")}>
                    <FolderOpen aria-hidden /> Files
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => { close(); recorder.open(); }} value="record screen video capture">
                    <Video aria-hidden /> Record screen
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go("/messages")}>
                    <MessagesSquare aria-hidden /> Messages
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go("/settings")}>
                    <Settings aria-hidden /> Settings
                  </Command.Item>
                  {canSeeAppRelease(role) && (
                    <Command.Item className={itemClass} onSelect={() => go("/settings/android-app")} value="get the android app apk download">
                      <Smartphone aria-hidden /> Get the Android app
                    </Command.Item>
                  )}
                  {roleAtLeast(role, "admin") && (
                    <>
                      <Command.Item className={itemClass} onSelect={() => go("/settings/members")}>
                        <Users aria-hidden /> Members and invites
                      </Command.Item>
                      <Command.Item className={itemClass} onSelect={() => go("/settings/audit-log")}>
                        <FileClock aria-hidden /> Audit log
                      </Command.Item>
                    </>
                  )}
                </Command.Group>
                {projects.length > 0 && (
                  <Command.Group heading="Projects" className={groupClass}>
                    {projects.map((p) => (
                      <Command.Item
                        key={p.id}
                        value={`${p.name} ${p.spaceName} ${p.id}`}
                        className={itemClass}
                        onSelect={() => go(`/p/${p.id}`)}
                      >
                        <span aria-hidden className="ml-1 mr-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="truncate">{p.name}</span>
                        <span className="ml-auto truncate text-12 text-fg-faint">{p.spaceName}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SearchMode({
  query,
  setQuery,
  onBack,
  go,
}: {
  query: string;
  setQuery: (q: string) => void;
  onBack: () => void;
  go: (href: string) => void;
}) {
  const { workspaceId } = useWorkspace();
  const q = useDebounced(query.trim(), 200);
  const results = useSearch(workspaceId, q);
  const enabled = results.enabled;

  async function openDm(userId: string) {
    try {
      const c = await api<Conversation>(`/v1/workspaces/${workspaceId}/dms`, {
        method: "POST",
        body: { user_id: userId },
      });
      go(`/messages/${c.id}`);
    } catch (e) {
      toast.error("Couldn't open the conversation", { description: errorMessage(e) });
    }
  }

  const data = results.data;
  const empty = data && data.tasks.length + data.projects.length + data.people.length === 0;

  return (
    <Command shouldFilter={false} loop label="Search tasks" className="flex flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-border-subtle px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to commands"
          className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && query === "") onBack();
          }}
          placeholder="Search tasks, projects and people"
          className="h-full flex-1 bg-transparent text-14 text-fg outline-none placeholder:text-fg-faint"
        />
        {results.isFetching && <Spinner className="text-fg-faint" />}
      </div>
      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
        {!enabled ? (
          <p className="px-3 py-8 text-center text-13 text-fg-muted">
            {workspaceId ? "Type at least 2 characters." : "Search is unavailable until your workspace loads."}
          </p>
        ) : (results.isError && results.data === undefined) ? (
          <p className="flex items-center justify-center gap-2 px-3 py-8 text-13 text-fg-muted">
            <CircleAlert className="size-4 text-danger" aria-hidden />
            {errorMessage(results.error)}
          </p>
        ) : empty ? (
          <p className="px-3 py-8 text-center text-13 text-fg-muted">No results for &ldquo;{q}&rdquo;.</p>
        ) : data ? (
          <>
            {data.tasks.length > 0 && (
              <Command.Group heading="Tasks" className={groupClass}>
                {data.tasks.map((t) => (
                  <Command.Item key={t.id} value={`task-${t.id}`} className={itemClass} onSelect={() => go(`/t/${t.id}`)}>
                    <CheckSquare aria-hidden />
                    <span className={cn("min-w-0 flex-1 truncate", t.completed && "text-fg-muted line-through decoration-fg-faint")}>
                      {t.title}
                    </span>
                    <PriorityBadge priority={t.priority} iconOnly />
                    <span className="max-w-40 truncate text-12 text-fg-faint">{t.project_name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {data.projects.length > 0 && (
              <Command.Group heading="Projects" className={groupClass}>
                {data.projects.map((p) => (
                  <Command.Item key={p.id} value={`project-${p.id}`} className={itemClass} onSelect={() => go(`/p/${p.id}`)}>
                    <FolderKanban aria-hidden style={{ color: p.color }} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="truncate text-12 text-fg-faint">{p.space_name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {data.people.length > 0 && (
              <Command.Group heading="People" className={groupClass}>
                {data.people.map((u) => (
                  <Command.Item key={u.id} value={`person-${u.id}`} className={itemClass} onSelect={() => void openDm(u.id)}>
                    <Avatar user={u} size="xs" decorative />
                    <span className="min-w-0 flex-1 truncate">{u.full_name || u.email}</span>
                    <span className="text-12 text-fg-faint">Message</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </>
        ) : null}
      </Command.List>
    </Command>
  );
}
