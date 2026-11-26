import {
  AtSign,
  Bell,
  CalendarClock,
  Archive,
  CircleAlert,
  FileClock,
  FolderPlus,
  Hash,
  MessageSquare,
  MessagesSquare,
  RefreshCcw,
  KeyRound,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NotificationKind } from "@/lib/api/types";
import type { KnownKind } from "./kinds";

/** Every kind in the generated type needs an icon: adding a kind to the API breaks tsc here until it has one. */
export const KIND_ICON: Record<NotificationKind | KnownKind, LucideIcon> = {
  task_assigned: UserPlus,
  mentioned: AtSign,
  task_comment: MessageSquare,
  task_due_soon: CalendarClock,
  task_overdue: CircleAlert,
  direct_message: MessagesSquare,
  channel_message: Hash,
  task_status_changed: RefreshCcw,
  added_to_project: FolderPlus,
  role_changed: ShieldCheck,
  member_joined: Users,
  file_expiring: FileClock,
  invite_accepted: UserCheck,
  client_access_changed: KeyRound,
  project_archived: Archive,
  space_archived: Archive,
  app_update: Smartphone,
};

export function kindIcon(kind: string): LucideIcon {
  return (KIND_ICON as Record<string, LucideIcon | undefined>)[kind] ?? Bell;
}

/** Renders the kind's icon. A component (not a looked-up value) so it can be used inside render. */
export function KindIcon({ kind, className, strokeWidth }: { kind: string; className?: string; strokeWidth?: number }) {
  const Icon = kindIcon(kind);
  // The icon comes from the module-level table above, so it is stable across renders.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
