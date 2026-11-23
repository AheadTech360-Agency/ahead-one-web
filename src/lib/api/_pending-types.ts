/*
 * DELETE when /shared/types exists.
 *
 * Temporary hand copy of the DTOs in docs/api-contract.md that ts-rs has NOT generated yet
 * (tasks, messaging, notifications, dashboards). Types already generated into /shared/types
 * are re-exported from ./types.ts and must not be duplicated here: delete each entry below
 * as its generated file lands. Nothing outside src/lib/api/types.ts may import this file.
 */
import type { ConversationKind } from "@shared/types/ConversationKind";
import type { NotificationKind } from "@shared/types/NotificationKind";
import type { Priority } from "@shared/types/Priority";
import type { ProjectPermission } from "@shared/types/ProjectPermission";
import type { PushPlatform } from "@shared/types/PushPlatform";
import type { StatusCategory } from "@shared/types/StatusCategory";
import type { UserSummary } from "@shared/types/UserSummary";
import type { Visibility } from "@shared/types/Visibility";
import type { JsonValue } from "@shared/types/serde_json/JsonValue";

/** Tiptap JSON document. */
export type RichDoc = JsonValue;

/* ---------- M2 tasks ---------- */

export type TreeList = { id: string; name: string };
export type TreeProject = {
  id: string;
  name: string;
  color: string;
  visibility: Visibility;
  archived: boolean;
  lists: TreeList[];
};
export type TreeSpace = { id: string; name: string; color: string; projects: TreeProject[] };

export type Space = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  position: number;
  archived_at: string | null;
};

export type Project = {
  id: string;
  space_id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  visibility: Visibility;
  archived_at: string | null;
  my_permission: ProjectPermission;
  created_at: string;
};

export type ProjectMember = { user: UserSummary; permission: ProjectPermission };

export type List = {
  id: string;
  project_id: string;
  name: string;
  position: number;
  archived_at: string | null;
};

export type ListStatus = {
  id: string;
  list_id: string;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
};

export type Task = {
  id: string;
  list_id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  status_id: string;
  priority: Priority;
  due_at: string | null;
  due_has_time: boolean;
  position: number;
  assignees: UserSummary[];
  subtask_count: number;
  done_subtask_count: number;
  comment_count: number;
  attachment_count: number;
  created_by: UserSummary | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Attachment = {
  id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  uploader: UserSummary | null;
  created_at: string;
};

export type TaskDetail = {
  task: Task;
  description: RichDoc | null;
  subtasks: Task[];
  attachments: Attachment[];
  list: List;
  statuses: ListStatus[];
  project: Project;
};

export type Comment = {
  id: string;
  task_id: string;
  author: UserSummary | null;
  body: RichDoc;
  created_at: string;
  edited_at: string | null;
};

export type Activity = {
  id: string;
  actor: UserSummary | null;
  kind: string;
  payload: JsonValue;
  created_at: string;
};

export type UploadTicket = {
  attachment_id: string;
  upload_url: string;
  token: string;
  expires_at: string;
};

export type DownloadUrl = { url: string; expires_at: string };

/* ---------- M2 requests ---------- */

export type CreateSpace = { name: string; color?: string };
export type UpdateSpace = { name?: string; color?: string; position?: number };
export type CreateProject = {
  name: string;
  description?: string;
  color?: string;
  visibility?: Visibility;
};
export type UpdateProject = {
  name?: string;
  description?: string | null;
  color?: string;
  visibility?: Visibility;
};
export type SetProjectMember = { permission: ProjectPermission };
export type CreateList = { name: string };
export type UpdateList = { name?: string; position?: number };
export type CreateStatus = { name: string; color: string; category: StatusCategory };
export type UpdateStatus = { name?: string; color?: string; category?: StatusCategory };
export type TaskSort = "position" | "due" | "priority" | "created" | "title";
export type SortDir = "asc" | "desc";
export type TaskQuery = {
  assignee?: string;
  status?: string;
  priority?: Priority;
  due_from?: string;
  due_to?: string;
  sort?: TaskSort;
  dir?: SortDir;
  parent?: string;
  cursor?: string;
  limit?: number;
};
export type CreateTask = {
  title: string;
  description?: RichDoc;
  status_id?: string;
  priority?: Priority;
  due_at?: string;
  due_has_time?: boolean;
  assignee_ids?: string[];
  parent_task_id?: string;
};
export type UpdateTask = {
  title?: string;
  description?: RichDoc;
  status_id?: string;
  priority?: Priority;
  due_at?: string | null;
  due_has_time?: boolean;
  list_id?: string;
  position_after?: string;
  position_before?: string;
};
export type CreateUpload = { filename: string; mime: string; size_bytes: number };
export type CreateComment = { body: RichDoc };

/* ---------- M3 messaging ---------- */

export type Message = {
  id: string;
  conversation_id: string;
  author: UserSummary | null;
  body: string;
  attachments: Attachment[];
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
};

export type Conversation = {
  id: string;
  kind: ConversationKind;
  name: string | null;
  is_private: boolean;
  topic: string | null;
  members: UserSummary[];
  member_count: number;
  last_message: Message | null;
  unread_count: number;
  last_read_message_id: string | null;
  created_at: string;
};

export type ReadState = { user_id: string; last_read_message_id: string };

export type WsServerEvent =
  | { type: "ready" }
  | { type: "message.created"; message: Message }
  | { type: "message.updated"; message: Message }
  | { type: "message.deleted"; conversation_id: string; message_id: string }
  | { type: "typing"; conversation_id: string; user: UserSummary }
  | { type: "read"; conversation_id: string; user_id: string; message_id: string }
  | { type: "notification.created"; notification: Notification }
  | { type: "conversation.updated"; conversation: Conversation };

export type WsClientEvent =
  | { type: "auth"; token: string }
  | { type: "typing"; conversation_id: string }
  | { type: "ping" };

/* ---------- M4 views, search, notifications, dashboards ---------- */

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  actor: UserSummary | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPref = {
  kind: NotificationKind;
  in_app: boolean;
  email: boolean;
  push: boolean;
};
export type NotificationPrefs = { prefs: NotificationPref[]; daily_digest: boolean };
export type UnreadCount = { count: number };

export type TaskHit = {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  list_id: string;
  status_id: string;
  priority: Priority;
};
export type ProjectHit = { id: string; name: string; space_name: string };
export type SearchResults = { tasks: TaskHit[]; projects: ProjectHit[]; people: UserSummary[] };

export type MyTask = { task: Task; project_name: string; list_name: string };
export type WorkloadRow = { user: UserSummary; open: number; overdue: number; due_this_week: number };
export type ProjectStat = {
  id: string;
  name: string;
  color: string;
  open: number;
  overdue: number;
  done: number;
};
export type ActivityFeedItem = {
  id: string;
  actor: UserSummary | null;
  kind: string;
  task_id: string;
  task_title: string;
  project_name: string;
  payload: JsonValue;
  created_at: string;
};
export type MentionItem = {
  id: string;
  actor: UserSummary | null;
  source_type: string;
  task_id: string | null;
  conversation_id: string | null;
  excerpt: string;
  created_at: string;
};

export type Dashboard =
  | {
      kind: "org";
      active_projects: number;
      overdue_tasks: number;
      open_tasks: number;
      completed_this_week: number;
      members: number;
      projects: ProjectStat[];
      activity: ActivityFeedItem[];
    }
  | { kind: "management"; workload: WorkloadRow[]; overdue: MyTask[]; upcoming: MyTask[] }
  | {
      kind: "personal";
      today: MyTask[];
      upcoming: MyTask[];
      overdue: MyTask[];
      mentions: MentionItem[];
      activity: ActivityFeedItem[];
    };

export type MyTasksBucket = "today" | "upcoming" | "overdue" | "all";
export type RegisterPushToken = { token: string; platform: PushPlatform };
