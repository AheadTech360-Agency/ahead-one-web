import {
  AtSign,
  Bell,
  CalendarClock,
  CircleAlert,
  FolderPlus,
  Hash,
  MessageSquare,
  MessagesSquare,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
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
  app_update: Smartphone,
};

export function kindIcon(kind: string): LucideIcon {
  return (KIND_ICON as Record<string, LucideIcon | undefined>)[kind] ?? Bell;
}
