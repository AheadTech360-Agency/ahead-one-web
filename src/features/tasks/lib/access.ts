import type { Project, ProjectPermission, Task } from "@/lib/api/types";

const RANK: Record<ProjectPermission, number> = { view: 0, comment: 1, edit: 2, manage: 3 };

export function permAtLeast(p: ProjectPermission | undefined, min: ProjectPermission) {
  return p !== undefined && RANK[p] >= RANK[min];
}

export type Access = {
  permission: ProjectPermission | undefined;
  archived: boolean;
  canEdit: boolean;
  canManage: boolean;
  canComment: boolean;
  /** Comment-level people may still move the status of tasks assigned to them. */
  canChangeStatus: (task: Pick<Task, "assignees">) => boolean;
  /** One line for read-only surfaces, or null when editing is allowed. */
  readOnlyReason: string | null;
};

export function projectAccess(project: Project | undefined, meId: string | undefined): Access {
  const permission = project?.my_permission;
  const archived = Boolean(project?.archived_at);
  const canEdit = !archived && permAtLeast(permission, "edit");
  const canManage = !archived && permAtLeast(permission, "manage");
  const canComment = !archived && permAtLeast(permission, "comment");
  return {
    permission,
    archived,
    canEdit,
    canManage,
    canComment,
    canChangeStatus: (task) =>
      canEdit || (canComment && permission === "comment" && task.assignees.some((a) => a.id === meId)),
    readOnlyReason: !project
      ? null
      : archived
        ? "This project is archived. Restore it to make changes."
        : permission === "view"
          ? "You can view this project. Ask a project manager for edit access."
          : permission === "comment"
            ? "You can comment here and move the status of tasks assigned to you."
            : null,
  };
}

export const PERMISSION_LABEL: Record<ProjectPermission, string> = {
  view: "Can view",
  comment: "Can comment",
  edit: "Can edit",
  manage: "Can manage",
};

export const PERMISSION_HINT: Record<ProjectPermission, string> = {
  view: "Sees tasks, files and comments",
  comment: "Also comments, and moves the status of their own tasks",
  edit: "Also creates, edits and deletes tasks",
  manage: "Also edits lists, statuses, members and settings",
};
