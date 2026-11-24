"use client";

import { Archive, ChevronRight, FolderPlus, ListPlus, Lock, MoreHorizontal, Pencil, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api/client";
import {
  useArchiveNode,
  useCreateNode,
  useRenameNode,
  useTree,
  type TreeNodeKind,
} from "@/lib/api/hooks";
import type { TreeSpace } from "@/lib/api/types";
import { useStoredState } from "@/lib/hooks/use-stored-state";
import { cn } from "@/lib/utils";
import { roleAtLeast, useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogBody, DialogClose } from "@/ui/dialog";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import { SidebarSection } from "./sidebar-section";

type Node = { kind: TreeNodeKind; id: string; name: string; parentId?: string };
type CreateTarget = { kind: TreeNodeKind; parentId?: string; parentName?: string };

const CHILD_KIND: Partial<Record<TreeNodeKind, TreeNodeKind>> = { space: "project", project: "list" };
const KIND_LABEL: Record<TreeNodeKind, string> = { space: "space", project: "project", list: "list" };

export function SpacesTree({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaceId, role } = useWorkspace();
  const tree = useTree(workspaceId);
  const canManageSpaces = roleAtLeast(role, "management");
  const [expanded, setExpanded] = useStoredState<string[]>("ahead-one.tree-expanded", []);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Node | null>(null);
  const [creating, setCreating] = useState<CreateTarget | null>(null);

  const rename = useRenameNode(workspaceId ?? "");
  const archive = useArchiveNode(workspaceId ?? "");

  const toggle = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function submitRename(node: Node, name: string) {
    setRenaming(null);
    const trimmed = name.trim();
    if (!trimmed || trimmed === node.name) return;
    rename.mutate(
      { kind: node.kind, id: node.id, name: trimmed },
      {
        onSuccess: () => toast.success(`Renamed to ${trimmed}`),
        onError: (e) => toast.error(`Couldn't rename ${node.name}`, { description: errorMessage(e) }),
      },
    );
  }

  const actions: TreeActions = {
    expanded,
    toggle,
    renaming,
    startRename: setRenaming,
    submitRename,
    cancelRename: () => setRenaming(null),
    archive: setArchiving,
    create: setCreating,
    canManageSpaces,
    onNavigate,
  };

  return (
    <SidebarSection
      title="Spaces"
      storageKey="spaces"
      action={
        canManageSpaces
          ? { label: "Create space", onClick: () => setCreating({ kind: "space" }) }
          : undefined
      }
    >
      {tree.isPending && workspaceId ? (
        <TreeSkeleton />
      ) : tree.isError || !workspaceId || !tree.data ? (
        <div className="px-2 py-1.5 text-12 text-fg-muted">
          <p>Couldn&apos;t load spaces.</p>
          {workspaceId && (
            <button
              type="button"
              onClick={() => tree.refetch()}
              className="mt-1 inline-flex items-center gap-1 font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <RotateCw className="size-3" aria-hidden /> Retry
            </button>
          )}
        </div>
      ) : tree.data.length === 0 ? (
        <p className="px-2 py-1.5 text-12 text-fg-muted">
          {canManageSpaces ? "No spaces yet. Create one to group projects." : "No spaces shared with you yet."}
        </p>
      ) : (
        <ul aria-label="Spaces" className="flex flex-col gap-px">
          {tree.data.map((space) => (
            <SpaceNode key={space.id} space={space} actions={actions} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={archiving ? `Archive ${archiving.name}?` : ""}
        description={
          archiving?.kind === "space"
            ? "The space and its projects leave the sidebar for everyone. You can restore it later."
            : archiving?.kind === "project"
              ? "The project and its lists leave the sidebar for everyone. You can restore it later."
              : "The list leaves the sidebar for everyone. You can restore it later."
        }
        confirmLabel={archiving ? `Archive ${KIND_LABEL[archiving.kind]}` : "Archive"}
        loading={archive.isPending}
        onConfirm={() => {
          if (!archiving) return;
          const node = archiving;
          archive.mutate(
            { kind: node.kind, id: node.id },
            {
              onSuccess: () => {
                toast.success(`Archived ${node.name}`);
                setArchiving(null);
              },
              onError: (e) => toast.error(`Couldn't archive ${node.name}`, { description: errorMessage(e) }),
            },
          );
        }}
      />
      <CreateNodeDialog target={creating} onClose={() => setCreating(null)} />
    </SidebarSection>
  );
}

type TreeActions = {
  expanded: string[];
  toggle: (id: string) => void;
  renaming: string | null;
  startRename: (id: string) => void;
  submitRename: (node: Node, name: string) => void;
  cancelRename: () => void;
  archive: (node: Node) => void;
  create: (t: CreateTarget) => void;
  canManageSpaces: boolean;
  onNavigate?: () => void;
};

function SpaceNode({ space, actions }: { space: TreeSpace; actions: TreeActions }) {
  const open = actions.expanded.includes(space.id);
  const node: Node = { kind: "space", id: space.id, name: space.name };
  return (
    <li>
      <Row
        node={node}
        depth={0}
        open={open}
        hasChildren
        color={space.color}
        shape="square"
        actions={actions}
        canEdit={actions.canManageSpaces}
      />
      {open && (
        <ul className="flex flex-col gap-px">
          {space.projects.length === 0 && (
            <li className="py-1 pl-9 text-12 text-fg-faint">
              No projects
            </li>
          )}
          {space.projects.map((p) => {
            const pOpen = actions.expanded.includes(p.id);
            const pNode: Node = { kind: "project", id: p.id, name: p.name, parentId: space.id };
            return (
              <li key={p.id}>
                <Row
                  node={pNode}
                  depth={1}
                  open={pOpen}
                  hasChildren={p.lists.length > 0}
                  color={p.color}
                  shape="dot"
                  href={`/p/${p.id}`}
                  isPrivate={p.visibility === "private"}
                  actions={actions}
                  canEdit={actions.canManageSpaces}
                />
                {pOpen && (
                  <ul className="flex flex-col gap-px">
                    {p.lists.map((l) => (
                      <li key={l.id}>
                        <Row
                          node={{ kind: "list", id: l.id, name: l.name, parentId: p.id }}
                          depth={2}
                          href={`/l/${l.id}`}
                          actions={actions}
                          canEdit={actions.canManageSpaces}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Row({
  node,
  depth,
  open,
  hasChildren,
  color,
  shape,
  href,
  isPrivate,
  actions,
  canEdit,
}: {
  node: Node;
  depth: number;
  open?: boolean;
  hasChildren?: boolean;
  color?: string;
  shape?: "square" | "dot";
  href?: string;
  isPrivate?: boolean;
  actions: TreeActions;
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const active = href ? pathname === href : false;
  const childKind = CHILD_KIND[node.kind];
  const editing = actions.renaming === node.id;

  const label = editing ? (
    <RenameInput
      initial={node.name}
      onSubmit={(name) => actions.submitRename(node, name)}
      onCancel={actions.cancelRename}
    />
  ) : href ? (
    <Link
      href={href}
      onClick={actions.onNavigate}
      aria-current={active ? "page" : undefined}
      className="min-w-0 flex-1 truncate py-1 outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-ring"
    >
      {node.name}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => actions.toggle(node.id)}
      aria-expanded={open}
      className="min-w-0 flex-1 truncate py-1 text-left outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-ring"
    >
      {node.name}
    </button>
  );

  const menuItems = (Item: typeof DropdownMenuItem | typeof ContextMenuItem, Sep: React.FC) => (
    <>
      {childKind && (
        <Item onSelect={() => actions.create({ kind: childKind, parentId: node.id, parentName: node.name })}>
          {childKind === "project" ? <FolderPlus aria-hidden /> : <ListPlus aria-hidden />}
          New {childKind}
        </Item>
      )}
      <Item onSelect={() => actions.startRename(node.id)}>
        <Pencil aria-hidden /> Rename
      </Item>
      <Sep />
      <Item danger onSelect={() => actions.archive(node)}>
        <Archive aria-hidden /> Archive
      </Item>
    </>
  );

  const row = (
    <div
      className={cn(
        "group/row relative flex h-[30px] items-center gap-1.5 rounded-sm pr-1 text-13",
        active ? "bg-active font-semibold text-accent-text" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      {hasChildren !== undefined || node.kind !== "list" ? (
        <button
          type="button"
          tabIndex={href && hasChildren ? 0 : -1}
          aria-hidden={href && hasChildren ? undefined : true}
          aria-label={href ? `${open ? "Collapse" : "Expand"} ${node.name}` : undefined}
          aria-expanded={href && hasChildren ? open : undefined}
          onClick={() => actions.toggle(node.id)}
          className={cn(
            "relative z-10 inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-fg-faint hover:bg-active hover:text-fg focus-visible:outline-2 focus-visible:outline-ring",
            !hasChildren && "invisible",
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn("size-3.5 transition-transform duration-[var(--dur-fast)]", open && "rotate-90")}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      {color ? (
        <span
          aria-hidden
          className={cn("size-2 shrink-0", shape === "square" ? "rounded-[3px]" : "rounded-full")}
          style={{ backgroundColor: color }}
        />
      ) : (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-border-strong" />
      )}
      {label}
      {isPrivate && !editing && <Lock className="size-3 shrink-0 text-fg-faint" aria-label="Private" />}
      {canEdit && !editing && (
        <span className="relative z-10 ml-auto flex shrink-0 items-center opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[[data-state=open]]:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${node.name}`}
              className="inline-flex size-6 items-center justify-center rounded-xs text-fg-faint hover:bg-active hover:text-fg focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-active"
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">{menuItems(DropdownMenuItem, DropdownMenuSeparator)}</DropdownMenuContent>
          </DropdownMenu>
          {childKind && (
            <button
              type="button"
              aria-label={`New ${childKind} in ${node.name}`}
              onClick={() => actions.create({ kind: childKind, parentId: node.id, parentName: node.name })}
              className="inline-flex size-6 items-center justify-center rounded-xs text-fg-faint hover:bg-active hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          )}
        </span>
      )}
    </div>
  );

  if (!canEdit) return row;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>{menuItems(ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>
    </ContextMenu>
  );
}

function RenameInput({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      aria-label="Name"
      value={value}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onSubmit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(value);
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="relative z-10 h-6 min-w-0 flex-1 rounded-xs border border-ring bg-surface px-1.5 text-13 text-fg outline-none ring-[3px] ring-[color-mix(in_srgb,var(--ring)_22%,transparent)]"
    />
  );
}

function CreateNodeDialog({ target, onClose }: { target: CreateTarget | null; onClose: () => void }) {
  const { workspaceId } = useWorkspace();
  const create = useCreateNode(workspaceId ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const kind = target?.kind ?? "space";

  function close() {
    setName("");
    setError(undefined);
    onClose();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(`Give the ${kind} a name.`);
      return;
    }
    create.mutate(
      { kind, parentId: target?.parentId, name: trimmed },
      {
        onSuccess: () => {
          toast.success(`Created ${trimmed}`);
          close();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && close()}>
      <DialogContent
        size="sm"
        title={`New ${kind}`}
        description={target?.parentName ? `In ${target.parentName}` : undefined}
      >
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <Field label="Name" error={error}>
              <Input
                autoFocus
                value={name}
                maxLength={120}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(undefined);
                }}
                placeholder={kind === "space" ? "Clients" : kind === "project" ? "Spring campaign" : "Creative"}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={create.isPending}>
              Create {kind}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-px" role="status" aria-label="Loading spaces">
      {[64, 48, 72, 56].map((w, i) => (
        <div key={i} className="flex h-[30px] items-center gap-2 pl-7">
          <Skeleton className="size-2 rounded-[3px]" />
          <Skeleton className="h-2.5" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
