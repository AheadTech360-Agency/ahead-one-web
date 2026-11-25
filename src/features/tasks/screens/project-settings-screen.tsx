"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Check, CircleAlert, FolderX, GripVertical, Lock, Globe, MoreHorizontal, Plus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useMembers } from "@/lib/api/hooks";
import type { List, ListStatus, Project, ProjectPermission, Role, StatusCategory, UserSummary, Visibility } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, roleAtLeast, useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Badge, StatusPill } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Field } from "@/ui/field";
import { IconButton } from "@/ui/icon-button";
import { Input, Textarea } from "@/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Select } from "@/ui/select";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import { UserPicker } from "@/ui/user-picker";
import {
  useCreateList,
  useCreateStatus,
  useDeleteStatus,
  useProject,
  useProjectLists,
  useProjectMembers,
  useRemoveProjectMember,
  useReorderStatuses,
  useSetListArchived,
  useSetProjectArchived,
  useSetProjectMember,
  useStatuses,
  useUpdateList,
  useUpdateProject,
  useUpdateStatus,
} from "../api";
import { PERMISSION_HINT, PERMISSION_LABEL, permAtLeast } from "../lib/access";
import { ArchivedBanner } from "./project-screen";
import { ScreenHeader } from "./screen-frame";

export const SWATCHES = ["#3d68b0", "#1d8a57", "#2f7db4", "#b0457a", "#c62f36", "#c4650a", "#a68a0d", "#8a5a2b", "#5b5d66", "#14161a"];

const CATEGORY: { value: StatusCategory; label: string; description: string }[] = [
  { value: "todo", label: "Not started", description: "Waiting to be picked up" },
  { value: "active", label: "In progress", description: "Someone is working on it" },
  { value: "done", label: "Done", description: "Finished; counts as complete" },
  { value: "closed", label: "Closed", description: "Won't be done; counts as complete" },
];

export function ProjectSettingsScreen() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProject(projectId);

  if ((project.isError && project.data === undefined)) {
    const gone = isApiError(project.error) && project.error.isNotFound;
    return (
      <div className="mx-auto max-w-[1152px] px-4 py-6 sm:px-6 md:px-8">
        <EmptyState
          className="py-24"
          tone={gone ? "neutral" : "danger"}
          icon={gone ? FolderX : CircleAlert}
          title={gone ? "This project isn't available" : "Settings didn't load"}
          description={gone ? "It was deleted, or you don't have access to it." : errorMessage(project.error)}
          action={<Button onClick={() => void project.refetch()}>Try again</Button>}
        />
      </div>
    );
  }
  if (!project.data) return <SettingsSkeleton />;

  const p = project.data;
  const isManager = permAtLeast(p.my_permission, "manage");
  const editable = isManager && !p.archived_at;

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col px-4 py-5 sm:px-6 md:px-8 md:py-6">
      <ScreenHeader
        context={
          <span className="inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" aria-hidden /> {p.name}
          </span>
        }
        eyebrowHref={`/p/${p.id}`}
        title="Project settings"
      />
      {p.archived_at && (
        <div className="mt-5">
          <ArchivedBanner projectId={p.id} name={p.name} canRestore={isManager} />
        </div>
      )}
      {!isManager && (
        <p className="mt-5 rounded-sm bg-surface-sunken px-3 py-2 text-13 text-fg-muted">
          You can see these settings. Only project managers can change them.
        </p>
      )}
      <div className="mt-2 flex flex-col">
        <Row id="general" title="General" description="The name, colour and who can find this project.">
          <GeneralPanel project={p} editable={editable} />
        </Row>
        <Row id="lists" title="Lists" description="Lists split a project's tasks. Drag to reorder; archived lists keep their tasks.">
          <ListsPanel projectId={p.id} editable={editable} />
        </Row>
        <Row
          id="statuses"
          title="Statuses"
          description="Each list has its own workflow. The category decides whether a task counts as done."
        >
          <StatusesPanel projectId={p.id} editable={editable} />
        </Row>
        <Row
          id="members"
          title="Members and permissions"
          description="Management, admins and owners always have full access. Guests can be given at most edit."
        >
          <MembersPanel project={p} editable={editable} />
        </Row>
        <Row id="archive" title={p.archived_at ? "Restore" : "Archive"} description="Archiving hides the project from the sidebar and makes it read-only. Nothing is deleted.">
          <ArchivePanel project={p} editable={isManager} />
        </Row>
      </div>
    </div>
  );
}

function Row({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-6 gap-4 border-b border-border-subtle py-8 last:border-b-0 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-10"
    >
      <div className="lg:pt-1">
        <h2 id={`${id}-title`} className="text-16 font-semibold text-fg">
          {title}
        </h2>
        <p className="mt-1 max-w-[40ch] text-13 text-fg-muted">{description}</p>
      </div>
      <div className="min-w-0 rounded-lg bg-surface-sunken p-4">{children}</div>
    </section>
  );
}

/* ---------- General ---------- */

function GeneralPanel({ project, editable }: { project: Project; editable: boolean }) {
  const update = useUpdateProject(project.id);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== project.name || (description.trim() || null) !== (project.description ?? null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the project a name.");
      return;
    }
    update.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => toast.success("Project saved"),
        onError: (err) => toast.error("Couldn't save the project", { description: `${errorMessage(err)} Your edits are still here.` }),
      },
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field label="Name" error={error}>
        <Input
          value={name}
          disabled={!editable}
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field label="Description" optional>
        <Textarea value={description} disabled={!editable} maxLength={2000} rows={3} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-13 font-medium text-fg" id="color-label">
          Colour
        </span>
        <div role="radiogroup" aria-labelledby="color-label" className="flex flex-wrap gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={project.color === c}
              aria-label={c}
              disabled={!editable}
              onClick={() => update.mutate({ color: c })}
              className="relative size-7 rounded-full ring-offset-2 ring-offset-surface-sunken transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:hover:scale-100 aria-checked:ring-2 aria-checked:ring-fg"
              style={{ backgroundColor: c }}
            >
              {project.color === c && <Check className="absolute inset-0 m-auto size-3.5 text-white" strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-13 font-medium text-fg" id="vis-label">
          Who can see it
        </span>
        <div role="radiogroup" aria-labelledby="vis-label" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { v: "workspace", icon: Globe, title: "Workspace", line: "Members can see and edit it" },
              { v: "private", icon: Lock, title: "Private", line: "Only people you add below" },
            ] as { v: Visibility; icon: typeof Globe; title: string; line: string }[]
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={project.visibility === o.v}
              disabled={!editable}
              onClick={() => project.visibility !== o.v && update.mutate({ visibility: o.v })}
              className={cn(
                "flex items-start gap-2.5 rounded-md border bg-surface p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default",
                project.visibility === o.v ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong",
              )}
            >
              <o.icon className={cn("mt-0.5 size-4", project.visibility === o.v ? "text-accent-text" : "text-fg-faint")} aria-hidden />
              <span>
                <span className="block text-13 font-medium text-fg">{o.title}</span>
                <span className="block text-12 text-fg-muted">{o.line}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      {editable && (
        <div>
          <Button type="submit" variant="primary" disabled={!dirty} loading={update.isPending}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}

/* ---------- Lists ---------- */

function ListsPanel({ projectId, editable }: { projectId: string; editable: boolean }) {
  const lists = useProjectLists(projectId);
  const create = useCreateList(projectId);
  const update = useUpdateList(projectId);
  const archive = useSetListArchived(projectId);
  const [name, setName] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (lists.isPending) return <PanelSkeleton rows={3} />;
  if ((lists.isError && lists.data === undefined)) return <PanelError error={lists.error} retry={() => void lists.refetch()} />;

  const active = lists.data.filter((l) => !l.archived_at);
  const archived = lists.data.filter((l) => l.archived_at);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = active.findIndex((l) => l.id === e.active.id);
    const to = active.findIndex((l) => l.id === e.over!.id);
    const next = arrayMove(active, from, to);
    update.mutate(
      { id: String(e.active.id), after_id: next[to - 1]?.id ?? null },
      { onError: (err) => toast.error("Couldn't reorder the list", { description: `${errorMessage(err)} The previous order is back.` }) },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={active.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {active.map((l) => (
              <ListRow
                key={l.id}
                list={l}
                editable={editable}
                onRename={(n) => update.mutate({ id: l.id, name: n }, { onError: (err) => toast.error("Couldn't rename the list", { description: errorMessage(err) }) })}
                onArchive={() =>
                  archive.mutate(
                    { id: l.id, archive: true },
                    {
                      onSuccess: () =>
                        toast.success(`${l.name} archived`, {
                          action: { label: "Undo", onClick: () => archive.mutate({ id: l.id, archive: false }) },
                        }),
                      onError: (err) => toast.error("Couldn't archive the list", { description: errorMessage(err) }),
                    },
                  )
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {active.length === 0 && <p className="px-2 py-3 text-13 text-fg-muted">No open lists. Add one to start adding tasks.</p>}
      {editable && (
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = name.trim();
            if (!v) return;
            create.mutate(v, {
              onSuccess: () => setName(""),
              onError: (err) => toast.error("Couldn't add the list", { description: `${errorMessage(err)} The name is still in the box.` }),
            });
          }}
        >
          <Input aria-label="New list name" placeholder="New list name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="flex-1" />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            <Plus aria-hidden /> Add list
          </Button>
        </form>
      )}
      {archived.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1 px-2 text-12 font-medium text-fg-muted">Archived</p>
          <ul>
            {archived.map((l) => (
              <li key={l.id} className="flex h-9 items-center gap-2 px-2 text-13 text-fg-muted">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={archive.isPending && archive.variables?.id === l.id}
                    onClick={() => archive.mutate({ id: l.id, archive: false }, { onError: (err) => toast.error("Couldn't restore the list", { description: errorMessage(err) }) })}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ListRow({ list, editable, onRename, onArchive }: { list: List; editable: boolean; onRename: (n: string) => void; onArchive: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: list.id, disabled: !editable });
  const [name, setName] = useState(list.name);
  const [prev, setPrev] = useState(list.name);
  if (prev !== list.name) {
    setPrev(list.name);
    setName(list.name);
  }
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex h-10 items-center gap-1.5 rounded-sm bg-surface px-1.5", isDragging && "relative z-10 shadow-popover")}
    >
      {editable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${list.name}`}
          className="inline-flex h-7 w-5 cursor-grab items-center justify-center rounded-xs text-fg-faint hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <input
        aria-label="List name"
        value={name}
        disabled={!editable}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const v = name.trim();
          if (v && v !== list.name) onRename(v);
          else setName(list.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(list.name);
            e.currentTarget.blur();
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-xs bg-transparent px-1.5 text-13 text-fg outline-none hover:bg-hover focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
      />
      <Link href={`/l/${list.id}`} className="px-1.5 text-12 text-fg-muted hover:text-fg hover:underline">
        Open
      </Link>
      {editable && (
        <IconButton label={`Archive ${list.name}`} size="sm" onClick={onArchive}>
          <Trash2 aria-hidden />
        </IconButton>
      )}
    </li>
  );
}

/* ---------- Statuses ---------- */

function StatusesPanel({ projectId, editable }: { projectId: string; editable: boolean }) {
  const lists = useProjectLists(projectId);
  const active = useMemo(() => (lists.data ?? []).filter((l) => !l.archived_at), [lists.data]);
  const [listId, setListId] = useState<string | undefined>();
  const current = listId && active.some((l) => l.id === listId) ? listId : active[0]?.id;

  if (lists.isPending) return <PanelSkeleton rows={4} />;
  if ((lists.isError && lists.data === undefined)) return <PanelError error={lists.error} retry={() => void lists.refetch()} />;
  if (!current) return <p className="px-2 py-3 text-13 text-fg-muted">Add a list first; each list has its own statuses.</p>;

  return (
    <div className="flex flex-col gap-3">
      {active.length > 1 && (
        <div className="max-w-xs">
          <Select
            aria-label="List"
            value={current}
            onValueChange={setListId}
            options={active.map((l) => ({ value: l.id, label: l.name }))}
          />
        </div>
      )}
      <StatusEditor key={current} listId={current} editable={editable} />
    </div>
  );
}

function StatusEditor({ listId, editable }: { listId: string; editable: boolean }) {
  const statuses = useStatuses(listId);
  const reorder = useReorderStatuses(listId);
  const create = useCreateStatus(listId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StatusCategory>("todo");
  const [color, setColor] = useState(SWATCHES[2]);
  const [deleting, setDeleting] = useState<ListStatus | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (statuses.isPending) return <PanelSkeleton rows={4} />;
  if ((statuses.isError && statuses.data === undefined)) return <PanelError error={statuses.error} retry={() => void statuses.refetch()} />;
  const rows = statuses.data;

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = arrayMove(
      rows.map((s) => s.id),
      rows.findIndex((s) => s.id === e.active.id),
      rows.findIndex((s) => s.id === e.over!.id),
    );
    reorder.mutate(ids, { onError: (err) => toast.error("Couldn't reorder the statuses", { description: `${errorMessage(err)} The previous order is back.` }) });
  }

  return (
    <div className="flex flex-col gap-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {rows.map((s) => (
              <StatusRow key={s.id} status={s} listId={listId} editable={editable} canDelete={rows.length > 1} onDelete={() => setDeleting(s)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {editable && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = name.trim();
            if (!v) return;
            create.mutate(
              { name: v, color, category },
              {
                onSuccess: () => setName(""),
                onError: (err) => toast.error("Couldn't add the status", { description: `${errorMessage(err)} Try a different name.` }),
              },
            );
          }}
        >
          <ColorPicker value={color} onChange={setColor} label="New status colour" />
          <Input aria-label="New status name" placeholder="New status" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="min-w-40 flex-1" />
          <Select
            aria-label="Category"
            value={category}
            onValueChange={(v) => setCategory(v as StatusCategory)}
            options={CATEGORY.map((c) => ({ value: c.value, label: c.label, description: c.description }))}
            className="w-36"
          />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            <Plus aria-hidden /> Add status
          </Button>
        </form>
      )}
      {deleting && <DeleteStatusDialog status={deleting} statuses={rows} listId={listId} onClose={() => setDeleting(null)} />}
    </div>
  );
}

function StatusRow({
  status,
  listId,
  editable,
  canDelete,
  onDelete,
}: {
  status: ListStatus;
  listId: string;
  editable: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const update = useUpdateStatus(listId);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: status.id, disabled: !editable });
  const [name, setName] = useState(status.name);
  const [prev, setPrev] = useState(status.name);
  if (prev !== status.name) {
    setPrev(status.name);
    setName(status.name);
  }
  const fail = (what: string) => (err: unknown) => toast.error(`Couldn't change the ${what}`, { description: `${errorMessage(err)} The previous value is back.` });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-sm bg-surface px-1.5 py-1", isDragging && "relative z-10 shadow-popover")}
    >
      {editable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${status.name}`}
          className="inline-flex h-7 w-5 cursor-grab items-center justify-center rounded-xs text-fg-faint hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      {editable ? (
        <ColorPicker value={status.color} onChange={(c) => update.mutate({ id: status.id, color: c }, { onError: fail("colour") })} label={`${status.name} colour`} />
      ) : (
        <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: status.color }} />
      )}
      <input
        aria-label="Status name"
        value={name}
        disabled={!editable}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const v = name.trim();
          if (v && v !== status.name) update.mutate({ id: status.id, name: v }, { onError: fail("name") });
          else setName(status.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-8 min-w-28 flex-1 rounded-xs bg-transparent px-1.5 text-13 text-fg outline-none hover:bg-hover focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
      />
      <span className="hidden sm:block">
        <StatusPill name={status.name} color={status.color} category={status.category} />
      </span>
      <Select
        aria-label={`${status.name} category`}
        size="sm"
        disabled={!editable}
        value={status.category}
        onValueChange={(v) => update.mutate({ id: status.id, category: v as StatusCategory }, { onError: fail("category") })}
        options={CATEGORY.map((c) => ({ value: c.value, label: c.label, description: c.description }))}
        className="w-32"
      />
      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={`More actions for ${status.name}`} size="sm" noTooltip>
              <MoreHorizontal aria-hidden />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem danger disabled={!canDelete} onSelect={onDelete}>
              <Trash2 aria-hidden /> Delete status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${label}: ${value}`}
        className="inline-flex size-8 items-center justify-center rounded-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-active"
      >
        <span aria-hidden className="size-3.5 rounded-full" style={{ backgroundColor: value }} />
      </PopoverTrigger>
      <PopoverContent className="grid grid-cols-5 gap-1.5 p-2" aria-label={label}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => {
              onChange(c);
              setOpen(false);
            }}
            className="relative size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{ backgroundColor: c }}
          >
            {value === c && <Check className="absolute inset-0 m-auto size-3 text-white" strokeWidth={3} aria-hidden />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function DeleteStatusDialog({ status, statuses, listId, onClose }: { status: ListStatus; statuses: ListStatus[]; listId: string; onClose: () => void }) {
  const del = useDeleteStatus(listId);
  const others = statuses.filter((s) => s.id !== status.id);
  const [moveTo, setMoveTo] = useState(others.find((s) => s.category === status.category)?.id ?? others[0]?.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Delete ${status.name}?`} description="Tasks with this status move to the status you pick. Nothing else changes." size="sm">
        <DialogBody>
          <Field label="Move its tasks to">
            <Select
              value={moveTo}
              onValueChange={setMoveTo}
              options={others.map((s) => ({ value: s.id, label: s.name, description: CATEGORY.find((c) => c.value === s.category)?.label }))}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={!moveTo}
            loading={del.isPending}
            onClick={() =>
              moveTo &&
              del.mutate(
                { id: status.id, moveTo },
                {
                  onSuccess: () => {
                    toast.success(`${status.name} deleted`);
                    onClose();
                  },
                  onError: (err) => toast.error("Couldn't delete the status", { description: `${errorMessage(err)} It's still in the list.` }),
                },
              )
            }
          >
            Delete {status.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Members ---------- */

const PERMS: ProjectPermission[] = ["view", "comment", "edit", "manage"];

function MembersPanel({ project, editable }: { project: Project; editable: boolean }) {
  const { workspaceId, me } = useWorkspace();
  const members = useProjectMembers(project.id);
  const workspace = useMembers(workspaceId);
  const set = useSetProjectMember(project.id);
  const remove = useRemoveProjectMember(project.id);
  const [adding, setAdding] = useState<string[]>([]);
  const [addPerm, setAddPerm] = useState<ProjectPermission>("edit");
  const [removing, setRemoving] = useState<UserSummary | null>(null);

  const roleOf = useMemo(() => new Map((workspace.data ?? []).map((m) => [m.user.id, m.role])), [workspace.data]);
  const inProject = new Set((members.data ?? []).map((m) => m.user.id));
  const candidates = (workspace.data ?? []).filter((m) => !inProject.has(m.user.id) && !roleAtLeast(m.role, "management")).map((m) => m.user);

  if (members.isPending) return <PanelSkeleton rows={4} />;
  if ((members.isError && members.data === undefined)) return <PanelError error={members.error} retry={() => void members.refetch()} />;

  const rows = [...members.data].sort((a, b) => PERMS.indexOf(b.permission) - PERMS.indexOf(a.permission) || a.user.full_name.localeCompare(b.user.full_name));

  function addPeople() {
    const users = adding.map((id) => candidates.find((u) => u.id === id)).filter((u): u is UserSummary => Boolean(u));
    for (const user of users) {
      const perm: ProjectPermission = roleOf.get(user.id) === "guest" && addPerm === "manage" ? "edit" : addPerm;
      set.mutate({ user, permission: perm }, { onError: (err) => toast.error(`Couldn't add ${user.full_name || user.email}`, { description: errorMessage(err) }) });
    }
    setAdding([]);
  }

  return (
    <div className="flex flex-col gap-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <UserPicker users={candidates} value={adding} onChange={setAdding} placeholder="Choose people" aria-label="People to add" className="min-w-48 flex-1" />
          <Select
            aria-label="Permission for new people"
            value={addPerm}
            onValueChange={(v) => setAddPerm(v as ProjectPermission)}
            options={PERMS.map((p) => ({ value: p, label: PERMISSION_LABEL[p], description: PERMISSION_HINT[p] }))}
            className="w-36"
          />
          <Button onClick={addPeople} disabled={adding.length === 0}>
            <UserPlus aria-hidden /> Add {adding.length > 1 ? `${adding.length} people` : "person"}
          </Button>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-border-subtle rounded-md bg-surface">
        {rows.map((m) => {
          const role = roleOf.get(m.user.id);
          const implicit = role !== undefined && roleAtLeast(role, "management");
          const isMe = m.user.id === me?.user.id;
          return (
            <li key={m.user.id} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <Avatar user={m.user} size="md" decorative />
              <div className="min-w-0 flex-1">
                <p className="truncate text-13 font-medium text-fg">
                  {m.user.full_name || m.user.email}
                  {isMe && <span className="ml-1.5 font-normal text-fg-faint">(you)</span>}
                </p>
                <p className="truncate text-12 text-fg-muted">{m.user.email}</p>
              </div>
              {role && <Badge tone={role === "guest" ? "warning" : "neutral"}>{ROLE_LABEL[role as Role]}</Badge>}
              {implicit || !editable ? (
                <span className="w-36 text-right text-12 text-fg-muted">{implicit ? "Full access by role" : PERMISSION_LABEL[m.permission]}</span>
              ) : (
                <>
                  <Select
                    aria-label={`Permission for ${m.user.full_name || m.user.email}`}
                    size="sm"
                    value={m.permission}
                    onValueChange={(v) =>
                      set.mutate(
                        { user: m.user, permission: v as ProjectPermission },
                        { onError: (err) => toast.error("Couldn't change the permission", { description: `${errorMessage(err)} The previous permission is back.` }) },
                      )
                    }
                    options={PERMS.map((p) => ({
                      value: p,
                      label: PERMISSION_LABEL[p],
                      description: PERMISSION_HINT[p],
                      disabled: role === "guest" && p === "manage",
                    }))}
                    className="w-32"
                  />
                  <IconButton label={`Remove ${m.user.full_name || m.user.email}`} size="sm" onClick={() => setRemoving(m.user)}>
                    <Trash2 aria-hidden />
                  </IconButton>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.full_name || removing?.email}?`}
        description={
          project.visibility === "workspace"
            ? "Their explicit permission is removed. As a workspace member they may keep edit access through the project's visibility."
            : "They lose access to this private project and its tasks."
        }
        confirmLabel={`Remove ${removing?.full_name.split(" ")[0] || "person"}`}
        onConfirm={() => {
          const u = removing;
          setRemoving(null);
          if (!u) return;
          remove.mutate(u.id, {
            onError: (err) =>
              toast.error(`Couldn't remove ${u.full_name || u.email}`, {
                description:
                  isApiError(err) && err.isNotFound
                    ? "Their access comes from workspace membership, not from this project. Make the project private to limit it."
                    : `${errorMessage(err)} They still have access.`,
              }),
          });
        }}
      />
    </div>
  );
}

/* ---------- Archive ---------- */

function ArchivePanel({ project, editable }: { project: Project; editable: boolean }) {
  const mutate = useSetProjectArchived(project.id);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const archived = Boolean(project.archived_at);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-13 text-fg-muted">
        {archived ? "Restoring brings it back to the sidebar and makes it editable again." : "You can restore an archived project at any time."}
      </p>
      <Button variant={archived ? "secondary" : "danger"} disabled={!editable} onClick={() => setOpen(true)}>
        {archived ? `Restore ${project.name}` : `Archive ${project.name}`}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setTyped("");
        }}
      >
        <DialogContent
          size="sm"
          title={archived ? `Restore ${project.name}?` : `Archive ${project.name}?`}
          description={
            archived
              ? "Everyone with access can see and edit it again."
              : "It leaves the sidebar and becomes read-only for everyone. Type the project name to confirm."
          }
        >
          {!archived && (
            <DialogBody>
              <Field label="Project name">
                <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={project.name} />
              </Field>
            </DialogBody>
          )}
          <DialogFooter className={archived ? "mt-3" : undefined}>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant={archived ? "primary" : "danger"}
              disabled={!archived && typed.trim() !== project.name}
              loading={mutate.isPending}
              onClick={() =>
                mutate.mutate(!archived, {
                  onSuccess: () => {
                    setOpen(false);
                    toast.success(archived ? `${project.name} restored` : `${project.name} archived`);
                  },
                  onError: (err) => toast.error(archived ? "Couldn't restore the project" : "Couldn't archive the project", { description: `${errorMessage(err)} Try again.` }),
                })
              }
            >
              {archived ? `Restore ${project.name}` : `Archive ${project.name}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- shared ---------- */

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-10 items-center gap-2 rounded-sm bg-surface px-3">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3" style={{ width: `${30 + ((i * 17) % 30)}%` }} />
        </div>
      ))}
    </div>
  );
}

function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <EmptyState compact tone="danger" icon={CircleAlert} title="This section didn't load" description={errorMessage(error)} action={<Button size="sm" onClick={retry}>Try again</Button>} />
  );
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 px-4 py-6 sm:px-6 md:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-56" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-4 lg:grid-cols-[320px_1fr] lg:gap-10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export { SettingsSkeleton };
