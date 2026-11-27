/*
 * Pure rules for "My private tasks": who has a personal project, how it is found in the sidebar
 * tree, and what must stay out of shared surfaces (client lists, pickers, mentions). The API is the
 * authority (nobody else can read the project); this only decides what to render. No React and no
 * "@/" value imports (type imports are erased), so `npm test` runs it under node:test.
 */
import type { Role, TreeList, TreeProject, TreeSpace, UserSummary } from "@/lib/api/types";

export const PERSONAL_NAME = "My private tasks";

/** Owner, Admin, Management and Member get a personal project; Guests never do (the API answers 403). */
export function canHavePersonal(role: Role | undefined): boolean {
  return role === "owner" || role === "admin" || role === "management" || role === "member";
}

export type PersonalInfo = { space: TreeSpace; project: TreeProject; list: TreeList };

/** The caller's own personal space, project and default list, or null before it was first used. */
export function findPersonal(tree: readonly TreeSpace[] | undefined): PersonalInfo | null {
  for (const space of tree ?? []) {
    if (!space.personal) continue;
    const project = space.projects.find((p) => !p.archived) ?? space.projects[0];
    const list = project?.lists[0];
    if (project && list) return { space, project, list };
  }
  return null;
}

/** The tree without the personal space: what client lists, pickers and access screens show. */
export function clientSpaces(tree: readonly TreeSpace[] | undefined): TreeSpace[] {
  return (tree ?? []).filter((s) => !s.personal);
}

export function personalProjectIds(tree: readonly TreeSpace[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const s of tree ?? []) if (s.personal) for (const p of s.projects) ids.add(p.id);
  return ids;
}

export function isPersonalProject(tree: readonly TreeSpace[] | undefined, projectId: string | undefined): boolean {
  return Boolean(projectId) && personalProjectIds(tree).has(projectId!);
}

/** Lock badge in My Tasks and Today: only for tasks of the personal project. */
export function showsLockBadge(projectId: string, personalIds: ReadonlySet<string>): boolean {
  return personalIds.has(projectId);
}

/** In a personal project the only assignee is the owner: no picker of other people, no mentions. */
export function personalPeople(me: UserSummary | undefined): UserSummary[] {
  return me ? [me] : [];
}

export type ShareTarget = { value: string; label: string; description: string };

/** Lists a private task may be moved to: every active list outside the personal space. */
export function shareTargets(tree: readonly TreeSpace[] | undefined): ShareTarget[] {
  return clientSpaces(tree)
    .filter((s) => !s.archived)
    .flatMap((s) =>
      s.projects
        .filter((p) => !p.archived)
        .flatMap((p) => p.lists.map((l) => ({ value: l.id, label: `${p.name} / ${l.name}`, description: s.name }))),
    );
}

export function shareConfirmCopy(taskTitle: string, projectName: string) {
  return {
    title: "Move to a shared project?",
    body: `"${taskTitle}" will move to ${projectName} and become visible to everyone who can see that project.`,
    confirm: `Move to ${projectName}`,
  };
}

/** The API's refusals on a move into a shared project, in plain words. */
export function moveErrorMessage(status: number | undefined, apiMessage: string | undefined): string {
  if (status === 422) return apiMessage || "This task can't be moved there.";
  if (status === 403 || status === 404) return "You can't move tasks into that project.";
  return apiMessage || "Something went wrong. Try again.";
}

/** The tree with the personal space added (used right after the ensure call, before a refetch). */
export function withPersonalSpace(
  tree: readonly TreeSpace[] | undefined,
  pp: { project: { id: string; color: string }; space_id: string; list_id: string },
  listName = "Tasks",
): TreeSpace[] {
  const base = tree ?? [];
  if (base.some((s) => s.personal)) return [...base];
  const personal: TreeSpace = {
    id: pp.space_id,
    name: PERSONAL_NAME,
    color: pp.project.color,
    archived: false,
    personal: true,
    projects: [
      {
        id: pp.project.id,
        name: PERSONAL_NAME,
        color: pp.project.color,
        visibility: "private",
        archived: false,
        lists: [{ id: pp.list_id, name: listName }],
      },
    ],
  };
  return [personal, ...base];
}
