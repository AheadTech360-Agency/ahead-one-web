"use client";

import { Archive, ChevronRight, FolderPlus, ListPlus, Lock, MoreHorizontal, Pencil, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import {
  useArchiveNode,
  useCreateNode,
  useRenameNode,
  useTree,
  type TreeNodeKind,
} from "@/lib/api/hooks";
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
import { Collapse, useLeaving, useRevealOnce, useSettled } from "./sidebar-motion";
import { SidebarSection } from "./sidebar-section";
import { sbRow, sbRowActive, sbRowIdle } from "./sidebar-styles";
import type { TreeSpace } from "@/lib/api/types";

type Node = { kind: TreeNodeKind; id: string; name: string; parentId?: string };
type CreateTarget = { kind: TreeNodeKind; parentId?: string; parentName?: string };

/** One tree node with its children, built once per tree payload. */
type TNode = Node & {
  level: 1 | 2 | 3;
  color?: string;
  shape?: "square" | "dot";
  href?: string;
  isPrivate?: boolean;
  /** Spaces are always expandable (they show "No projects"); projects only with lists. */
  expandable: boolean;
  children: TNode[];
};

const CHILD_KIND: Partial<Record<TreeNodeKind, TreeNodeKind>> = { space: "project", project: "list" };
const KIND_LABEL: Record<TreeNodeKind, string> = { space: "space", project: "project", list: "list" };
const domId = (id: string) => `sb-tree-${id}`;

function buildModel(data: TreeSpace[]): TNode[] {
  return data.map((space) => ({
    kind: "space",
    id: space.id,
    name: space.name,
    level: 1,
    color: space.color,
    shape: "square",
    expandable: true,
    children: space.projects.map((p) => ({
      kind: "project",
      id: p.id,
      name: p.name,
      parentId: space.id,
      level: 2,
      color: p.color,
      shape: "dot",
      href: `/p/${p.id}`,
      isPrivate: p.visibility === "private",
      expandable: p.lists.length > 0,
      children: p.lists.map((l) => ({
        kind: "list",
        id: l.id,
        name: l.name,
        parentId: p.id,
        level: 3,
        href: `/l/${l.id}`,
        expandable: false,
        children: [],
      })),
    })),
  }));
}

function flatten(nodes: TNode[], out: TNode[] = []) {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

type TreeActions = {
  toggle: (id: string) => void;
  startRename: (id: string) => void;
  submitRename: (node: Node, name: string) => void;
  cancelRename: () => void;
  archive: (node: Node) => void;
  create: (t: CreateTarget) => void;
  navigated: () => void;
};

type TreeCtxValue = {
  actions: TreeActions;
  expanded: ReadonlySet<string>;
  renaming: string | null;
  canEdit: boolean;
  tabbableId: string | undefined;
  activeId: string | undefined;
};

export function SpacesTree({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaceId, role } = useWorkspace();
  const tree = useTree(workspaceId);
  const pathname = usePathname();
  const canManageSpaces = roleAtLeast(role, "management");
  const [expandedList, setExpanded] = useStoredState<string[]>("ahead-one.tree-expanded", []);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Node | null>(null);
  const [creating, setCreating] = useState<CreateTarget | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const rename = useRenameNode(workspaceId ?? "");
  const archive = useArchiveNode(workspaceId ?? "");

  const expanded = useMemo(() => new Set(expandedList), [expandedList]);
  const model = useMemo(() => (tree.data ? buildModel(tree.data) : []), [tree.data]);
  const flat = useMemo(() => flatten(model), [model]);
  const byId = useMemo(() => new Map(flat.map((n) => [n.id, n])), [flat]);

  // Latest values for the stable action callbacks.
  const live = useRef({ rename, onNavigate });
  useEffect(() => {
    live.current = { rename, onNavigate };
  });

  const actions = useMemo<TreeActions>(
    () => ({
      toggle: (id) => setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      startRename: setRenaming,
      cancelRename: () => setRenaming(null),
      archive: setArchiving,
      create: setCreating,
      navigated: () => live.current.onNavigate?.(),
      submitRename: (node, name) => {
        setRenaming(null);
        const trimmed = name.trim();
        if (!trimmed || trimmed === node.name) return;
        live.current.rename.mutate(
          { kind: node.kind, id: node.id, name: trimmed },
          {
            onSuccess: () => toast.success(`Renamed to ${trimmed}`),
            onError: (e) => toast.error(`Couldn't rename ${node.name}`, { description: errorMessage(e) }),
          },
        );
      },
    }),
    [setExpanded],
  );

  /** Visible items in tree order: a node shows when every ancestor is expanded. */
  const visible = useMemo(() => {
    const shown = new Set<string>();
    const out: TNode[] = [];
    for (const n of flat) {
      if (!n.parentId || (shown.has(n.parentId) && expanded.has(n.parentId))) {
        shown.add(n.id);
        out.push(n);
      }
    }
    return out;
  }, [flat, expanded]);

  // Roving tabindex: the focused item, else the current page's item, else the first. Always a visible one.
  const activeNode = useMemo(() => flat.find((n) => n.href === pathname), [flat, pathname]);
  const tabbableId = useMemo(() => {
    const visibleIds = new Set(visible.map((n) => n.id));
    let candidate: TNode | undefined = focusId ? byId.get(focusId) : undefined;
    candidate ??= activeNode;
    while (candidate && !visibleIds.has(candidate.id)) candidate = candidate.parentId ? byId.get(candidate.parentId) : undefined;
    return (candidate ?? visible[0])?.id;
  }, [visible, byId, focusId, activeNode]);

  const typeahead = useRef({ buffer: "", timer: 0 });

  function focusNode(id: string | undefined) {
    if (id) document.getElementById(domId(id))?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea")) return;
    const item = target.closest<HTMLElement>('[role="treeitem"]');
    if (!item || e.ctrlKey || e.metaKey || e.altKey) return;
    const onItem = target === item;
    const onPrimary = target.hasAttribute("data-tree-primary");
    if (!onItem && !onPrimary) return;
    const node = byId.get(item.dataset.nodeId ?? "");
    if (!node) return;
    const idx = visible.findIndex((n) => n.id === node.id);
    const open = expanded.has(node.id);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusNode(visible[Math.min(visible.length - 1, idx + 1)]?.id);
        return;
      case "ArrowUp":
        e.preventDefault();
        focusNode(visible[Math.max(0, idx - 1)]?.id);
        return;
      case "Home":
        e.preventDefault();
        focusNode(visible[0]?.id);
        return;
      case "End":
        e.preventDefault();
        focusNode(visible[visible.length - 1]?.id);
        return;
      case "ArrowRight":
        e.preventDefault();
        if (!node.expandable) return;
        if (!open) actions.toggle(node.id);
        else if (node.children.length > 0) focusNode(node.children[0].id);
        return;
      case "ArrowLeft":
        e.preventDefault();
        if (node.expandable && open) actions.toggle(node.id);
        else focusNode(node.parentId);
        return;
      case "Enter":
      case " ": {
        if (!onItem) return;
        e.preventDefault();
        item.querySelector<HTMLElement>(":scope > .sb-item-inner > .sb-row [data-tree-label]")?.click();
        return;
      }
      case "ContextMenu":
      case "F10": {
        if (e.key === "F10" && !e.shiftKey) return;
        if (!onItem) return;
        e.preventDefault();
        const row = item.querySelector<HTMLElement>(":scope > .sb-item-inner > .sb-row");
        const r = row?.getBoundingClientRect();
        row?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: (r?.left ?? 0) + 24,
            clientY: (r?.top ?? 0) + (r?.height ?? 0) / 2,
          }),
        );
        return;
      }
    }

    // Type-ahead: letters jump to the next visible item whose name starts with them.
    if (e.key.length === 1 && e.key !== " ") {
      const t = typeahead.current;
      window.clearTimeout(t.timer);
      t.buffer += e.key.toLowerCase();
      t.timer = window.setTimeout(() => (t.buffer = ""), 600);
      const order = [...visible.slice(idx + (t.buffer.length > 1 ? 0 : 1)), ...visible.slice(0, idx + 1)];
      const hit = order.find((n) => n.name.toLowerCase().startsWith(t.buffer));
      if (hit) {
        e.preventDefault();
        focusNode(hit.id);
      }
    }
  }

  const ctx = useMemo<TreeCtxValue>(
    () => ({ actions, expanded, renaming, canEdit: canManageSpaces, tabbableId, activeId: activeNode?.id }),
    [actions, expanded, renaming, canManageSpaces, tabbableId, activeNode],
  );

  const ready = Boolean(workspaceId) && tree.isSuccess && model.length > 0;
  const settled = useSettled(ready);
  const reveal = useRevealOnce(ready);

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
        <TreeCtx.Provider value={ctx}>
          <ul
            role="tree"
            aria-label="Spaces"
            className="flex flex-col gap-px"
            data-sb-settled={settled}
            data-sb-reveal={reveal}
            onKeyDown={onKeyDown}
            onFocus={(e) => {
              const id = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset.nodeId;
              if (id && id !== focusId) setFocusId(id);
            }}
            suppressHydrationWarning
          >
            <Branch nodes={model} />
          </ul>
        </TreeCtx.Provider>
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

const TreeCtx = createContext<TreeCtxValue | null>(null);
function useTreeCtx() {
  const v = useContext(TreeCtx);
  if (!v) throw new Error("Tree item outside SpacesTree");
  return v;
}

/** A level of the tree. Removed nodes stay for one exit animation. */
function Branch({ nodes }: { nodes: TNode[] }) {
  const items = useLeaving(nodes);
  return (
    <>
      {items.map(({ item, leaving }) => (
        <Item key={item.id} node={item} leaving={leaving} />
      ))}
    </>
  );
}

function Item({ node, leaving }: { node: TNode; leaving: boolean }) {
  const { actions, expanded, renaming, canEdit, tabbableId, activeId } = useTreeCtx();
  const open = node.expandable && expanded.has(node.id);
  return (
    <li
      id={domId(node.id)}
      role="treeitem"
      data-node-id={node.id}
      data-leaving={leaving}
      aria-level={node.level}
      aria-label={node.name}
      aria-expanded={node.expandable ? open : undefined}
      aria-selected={activeId === node.id}
      aria-hidden={leaving || undefined}
      inert={leaving}
      tabIndex={leaving ? -1 : tabbableId === node.id ? 0 : -1}
      className="sb-item"
    >
      <div className="sb-item-inner">
        <Row
          node={node}
          open={open}
          renaming={renaming === node.id}
          canEdit={canEdit}
          tabbable={tabbableId === node.id}
          actions={actions}
        />
        {node.expandable && (
          <Collapse open={open}>
            <ul role="group" className="flex flex-col gap-px">
              {node.children.length === 0 && node.kind === "space" && (
                <li role="none" className="py-1 pl-9 text-12 text-fg-faint">
                  No projects
                </li>
              )}
              <Branch nodes={node.children} />
            </ul>
          </Collapse>
        )}
      </div>
    </li>
  );
}

const Row = memo(function Row({
  node,
  open,
  renaming,
  canEdit,
  tabbable,
  actions,
}: {
  node: TNode;
  open: boolean;
  renaming: boolean;
  canEdit: boolean;
  tabbable: boolean;
  actions: TreeActions;
}) {
  const pathname = usePathname();
  const { href, color, shape, isPrivate, expandable } = node;
  const active = href ? pathname === href : false;
  const childKind = CHILD_KIND[node.kind];
  const editing = renaming;
  const plain: Node = { kind: node.kind, id: node.id, name: node.name, parentId: node.parentId };

  const label = editing ? (
    <RenameInput
      initial={node.name}
      onSubmit={(name) => actions.submitRename(plain, name)}
      onCancel={actions.cancelRename}
    />
  ) : href ? (
    <Link
      href={href}
      onClick={actions.navigated}
      aria-current={active ? "page" : undefined}
      tabIndex={-1}
      data-tree-primary
      data-tree-label
      className="min-w-0 flex-1 truncate py-1 outline-none after:absolute after:inset-0 after:rounded-sm"
    >
      {node.name}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => actions.toggle(node.id)}
      aria-expanded={open}
      tabIndex={-1}
      data-tree-primary
      data-tree-label
      className="min-w-0 flex-1 truncate py-1 text-left outline-none after:absolute after:inset-0 after:rounded-sm"
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
      <Item danger onSelect={() => actions.archive(plain)}>
        <Archive aria-hidden /> Archive
      </Item>
    </>
  );

  const row = (
    <div
      data-active={active}
      className={cn(sbRow, "group/row gap-1.5 pr-1", active ? sbRowActive : sbRowIdle)}
      style={{ paddingLeft: 4 + (node.level - 1) * 14 }}
    >
      {node.kind !== "list" ? (
        <button
          type="button"
          tabIndex={-1}
          data-tree-primary={href && expandable ? true : undefined}
          aria-hidden={href && expandable ? undefined : true}
          aria-label={href ? `${open ? "Collapse" : "Expand"} ${node.name}` : undefined}
          aria-expanded={href && expandable ? open : undefined}
          onClick={() => actions.toggle(node.id)}
          className={cn(
            "relative z-10 inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-fg-faint hover:bg-active hover:text-fg focus-visible:outline-2 focus-visible:outline-ring",
            !expandable && "invisible",
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out-expo)]",
              open && "rotate-90",
            )}
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
        <span className="sb-actions relative z-10 ml-auto flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${node.name}`}
              tabIndex={tabbable ? 0 : -1}
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
              tabIndex={tabbable ? 0 : -1}
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
});

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
  // Same shape as the loaded tree: chevron slot, colour mark, label, with a nested pair.
  const rows: { w: number; level: number }[] = [
    { w: 56, level: 0 },
    { w: 44, level: 1 },
    { w: 62, level: 1 },
    { w: 48, level: 0 },
    { w: 70, level: 0 },
  ];
  return (
    <div className="flex flex-col gap-px" role="status" aria-label="Loading spaces">
      {rows.map((r, i) => (
        <div key={i} className="flex h-[30px] items-center gap-1.5 pr-1" style={{ paddingLeft: 4 + r.level * 14 }}>
          <span className="size-5 shrink-0" />
          <Skeleton shimmer className={r.level ? "size-2 rounded-full" : "size-2 rounded-[3px]"} />
          <Skeleton shimmer className="h-2.5" style={{ width: `${r.w}%` }} />
        </div>
      ))}
    </div>
  );
}
