"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { api } from "@/lib/api/client";
import { treeOptions, useTree } from "@/lib/api/hooks";
import type { PersonalProject, TreeSpace } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { canHavePersonal, findPersonal, personalProjectIds, withPersonalSpace } from "./logic";

/**
 * POST /v1/workspaces/:ws/personal is idempotent. On success the tree cache gets the personal space
 * at once (so the sidebar and the list screen resolve without waiting for a refetch), then refreshes.
 */
export function useEnsurePersonal() {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: () => api<PersonalProject>(`/v1/workspaces/${workspaceId}/personal`, { method: "POST" }),
    onSuccess: (pp) => {
      const key = treeOptions(workspaceId).queryKey;
      qc.setQueryData<TreeSpace[]>(key, (tree) => withPersonalSpace(tree, pp));
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** What the UI needs about the caller's private tasks. Guests get `enabled: false` and nothing else. */
export function usePersonal() {
  const { workspaceId, role } = useWorkspace();
  const tree = useTree(workspaceId);
  const router = useRouter();
  const ensure = useEnsurePersonal();
  const enabled = canHavePersonal(role);
  const info = useMemo(() => (enabled ? findPersonal(tree.data) : null), [enabled, tree.data]);
  const ids = useMemo(() => personalProjectIds(tree.data), [tree.data]);

  /** The personal list id, calling the ensure endpoint first when it does not exist yet. */
  const ensureListId = useCallback(async (): Promise<string> => {
    if (info) return info.list.id;
    return (await ensure.mutateAsync()).list_id;
  }, [info, ensure]);

  const open = useCallback(async () => {
    router.push(`/l/${await ensureListId()}`);
  }, [router, ensureListId]);

  return { enabled, info, ids, ensureListId, open, ensuring: ensure.isPending, treePending: tree.isPending };
}
