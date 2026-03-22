"use client";

import { useCallback, useEffect, useState } from "react";
import { getTreePermissions, canEditMember as checkCanEditMember, type TreePermissions } from "@/lib/actions/permissions";

export function useTreePermissions(treeId: string) {
  const [permissions, setPermissions] = useState<TreePermissions>({
    role: "viewer",
    isOwner: false,
    canEdit: false,
    linkedNodeId: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTreePermissions(treeId)
      .then(setPermissions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [treeId]);

  const canEditMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!permissions.canEdit) return false;
      if (permissions.isOwner) return true;
      // Editor: check descendant scope server-side
      return checkCanEditMember(treeId, memberId);
    },
    [treeId, permissions.canEdit, permissions.isOwner]
  );

  return {
    ...permissions,
    loading,
    canEditMember,
  };
}
