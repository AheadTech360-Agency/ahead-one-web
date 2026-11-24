"use client";

import {
  Archive,
  Bold,
  CheckSquare,
  Copy,
  Filter,
  FolderPlus,
  Inbox,
  Italic,
  LayoutList,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Priority, UserSummary } from "@/lib/api/types";
import { Avatar, AvatarStack } from "@/ui/avatar";
import { Badge, CountBadge, PRIORITIES, PriorityBadge, StatusPill } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Checkbox, Switch } from "@/ui/checkbox";
import { DatePicker } from "@/ui/date-picker";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Field } from "@/ui/field";
import { IconButton } from "@/ui/icon-button";
import { Input, Textarea } from "@/ui/input";
import { Kbd, KbdCombo } from "@/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { PasswordInput } from "@/ui/password-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Select } from "@/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet";
import { Skeleton, SkeletonRows } from "@/ui/skeleton";
import { Spinner } from "@/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "@/ui/toaster";
import { UserPicker } from "@/ui/user-picker";

/* Sample people for the gallery only. */
const PEOPLE: UserSummary[] = [
  { id: "7c1e0f5a-1", full_name: "Maya Brooks", email: "maya@example.com", avatar_url: null },
  { id: "2b9d4c11-2", full_name: "Daniel Ortiz", email: "daniel@example.com", avatar_url: null },
  { id: "e45a7b23-3", full_name: "Priya Raman", email: "priya@example.com", avatar_url: null },
  { id: "91f0c3d4-4", full_name: "Sam Whitaker", email: "sam@example.com", avatar_url: null },
  { id: "c3a8e9f5-5", full_name: "Leah Kim", email: "leah@example.com", avatar_url: null },
  { id: "5d2b7a06-6", full_name: "Jordan Ellis", email: "jordan@example.com", avatar_url: null },
];

const STATUSES = [
  { name: "To do", color: "#8a8f94", category: "todo" as const },
  { name: "In progress", color: "#2e5597", category: "active" as const },
  { name: "In review", color: "#c96a06", category: "active" as const },
  { name: "Approved", color: "#1d8a57", category: "done" as const },
  { name: "Blocked", color: "#c62f36", category: "todo" as const },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border-subtle pb-6">
      <h2 className="text-13 font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function Column() {
  const [due, setDue] = useState<Date | null>(null);
  const [assignees, setAssignees] = useState<string[]>([PEOPLE[0].id]);
  const [priority, setPriority] = useState<Priority>("high");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Block title="Button">
        <Row>
          <Button variant="primary">
            <Plus aria-hidden /> New task
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Trash2 aria-hidden /> Delete
          </Button>
        </Row>
        <Row>
          <Button size="sm" variant="primary">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button disabled>Disabled</Button>
        </Row>
      </Block>

      <Block title="Icon button and tooltip">
        <Row>
          <IconButton label="Bold" shortcut={["Ctrl", "B"]}>
            <Bold aria-hidden />
          </IconButton>
          <IconButton label="Italic" shortcut={["Ctrl", "I"]}>
            <Italic aria-hidden />
          </IconButton>
          <IconButton label="Filter tasks" variant="secondary">
            <Filter aria-hidden />
          </IconButton>
          <IconButton label="View options" size="sm">
            <Settings2 aria-hidden />
          </IconButton>
          <span className="flex items-center gap-2 pl-2 text-12 text-fg-muted">
            <KbdCombo keys={["Ctrl", "K"]} /> <Kbd>?</Kbd> <Kbd>Esc</Kbd>
          </span>
        </Row>
      </Block>

      <Block title="Fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Task title">
            <Input placeholder="Draft May retargeting creatives" />
          </Field>
          <Field label="Search" hint="Matches titles and descriptions.">
            <Input leading={<LayoutList />} placeholder="Search tasks" />
          </Field>
          <Field label="Client email" error="Enter a valid email address, like name@company.com.">
            <Input defaultValue="maya@" />
          </Field>
          <Field label="Password">
            <PasswordInput defaultValue="correct horse battery" />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
              options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            />
          </Field>
          <Field label="Due date" optional>
            <DatePicker value={due} onChange={setDue} className="w-full" />
          </Field>
          <Field label="Assignees" optional className="sm:col-span-2">
            <UserPicker users={PEOPLE} value={assignees} onChange={setAssignees} className="w-full sm:w-72" />
          </Field>
          <Field label="Brief" className="sm:col-span-2">
            <Textarea placeholder="What does done look like?" />
          </Field>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <Checkbox label="Notify assignees" description="They get an in-app notification and an email." defaultChecked />
          <Checkbox label="Partially selected" checked="indeterminate" />
          <Switch label="Daily digest" description="One email each morning." defaultChecked />
        </div>
      </Block>

      <Block title="Avatar, badge, priority, status">
        <Row>
          {PEOPLE.slice(0, 3).map((p) => (
            <Avatar key={p.id} user={p} size="md" />
          ))}
          <AvatarStack users={PEOPLE} max={4} />
          <CountBadge count={3} />
          <CountBadge count={128} />
        </Row>
        <Row>
          <Badge>Member</Badge>
          <Badge tone="accent">Admin</Badge>
          <Badge tone="success">Accepted</Badge>
          <Badge tone="warning">Expired</Badge>
          <Badge tone="danger">Revoked</Badge>
          <Badge tone="info">Guest</Badge>
        </Row>
        <Row>
          {PRIORITIES.map((p) => (
            <PriorityBadge key={p} priority={p} />
          ))}
        </Row>
        <Row>
          {STATUSES.map((s) => (
            <StatusPill key={s.name} {...s} />
          ))}
        </Row>
      </Block>

      <Block title="Overlays">
        <Row>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Spring campaign</DropdownMenuLabel>
              <DropdownMenuItem shortcut="R">
                <Pencil aria-hidden /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FolderPlus aria-hidden /> New list
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger>
                <Archive aria-hidden /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button>Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 text-13">
              <p className="font-medium">Spring campaign</p>
              <p className="mt-1 text-fg-muted">12 open tasks across 3 lists.</p>
            </PopoverContent>
          </Popover>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Dialog</Button>
            </DialogTrigger>
            <DialogContent title="Rename project" description="Everyone in the project sees the new name.">
              <DialogBody>
                <Field label="Name">
                  <Input defaultValue="Spring campaign" autoFocus />
                </Field>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="primary">Rename project</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Confirm
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Archive Spring campaign?"
            description="The project leaves the sidebar for everyone. You can restore it later."
            confirmLabel="Archive project"
            onConfirm={() => setConfirmOpen(false)}
          />
          <Sheet>
            <SheetTrigger asChild>
              <Button>Sheet</Button>
            </SheetTrigger>
            <SheetContent title="Task details" description="Spring campaign / Creative">
              <div className="p-4 text-13 text-fg-muted">Slide-over content.</div>
            </SheetContent>
          </Sheet>
          <Button
            onClick={() =>
              toast.success("Task created", {
                description: "Draft May retargeting creatives",
                action: { label: "Open", onClick: () => undefined },
              })
            }
          >
            Toast
          </Button>
          <Button onClick={() => toast.error("Couldn't save the task", { description: "Can't reach the server." })}>
            Error toast
          </Button>
        </Row>
      </Block>

      <Block title="Tabs">
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="pt-3 text-13 text-fg-muted">
            List view panel.
          </TabsContent>
          <TabsContent value="board" className="pt-3 text-13 text-fg-muted">
            Board view panel.
          </TabsContent>
          <TabsContent value="calendar" className="pt-3 text-13 text-fg-muted">
            Calendar view panel.
          </TabsContent>
        </Tabs>
      </Block>

      <Block title="Loading and empty">
        <Row>
          <Spinner />
          <span className="text-13 text-fg-muted">Inline spinner</span>
        </Row>
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
        <SkeletonRows rows={3} />
        <div className="rounded-md border border-border">
          <EmptyState
            compact
            icon={Inbox}
            title="You're all caught up"
            description="New assignments, mentions and due dates show up here."
            action={
              <Button size="sm">
                <CheckSquare aria-hidden /> View my tasks
              </Button>
            }
          />
        </div>
      </Block>
    </div>
  );
}

export function ComponentGallery() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-[1440px] items-baseline justify-between px-6 pb-4 pt-8">
        <div>
          <h1 className="text-20 font-semibold">Component library</h1>
          <p className="text-13 text-fg-muted">src/ui in light and dark. Development builds only.</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-4 px-6 pb-10 xl:grid-cols-2">
        <div data-theme="light" className="rounded-lg border border-border bg-surface p-6 text-fg">
          <p className="mb-5 text-12 font-medium text-fg-muted">Light</p>
          <Column />
        </div>
        <div data-theme="dark" className="rounded-lg border border-border bg-surface p-6 text-fg">
          <p className="mb-5 text-12 font-medium text-fg-muted">Dark</p>
          <Column />
        </div>
      </div>
    </div>
  );
}
