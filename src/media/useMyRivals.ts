import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MEDIA_CONFIG } from "./config";
import { getMyRivals, setMyRivals } from "./api";

const MAX_RIVALS = 2;
const EMPTY_RIVALS: number[] = [];

function myRivalsQueryKey(rosterId: number | null) {
  return ["mediaRoom", "myRivals", MEDIA_CONFIG.season, rosterId];
}

export function useMyRivals(rosterId: number | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: myRivalsQueryKey(rosterId),
    queryFn: () => getMyRivals(MEDIA_CONFIG.season, rosterId as number),
    enabled: rosterId !== null,
  });

  const rivals = query.data ?? EMPTY_RIVALS;

  const toggle = useCallback(
    async (targetRosterId: number) => {
      if (rosterId === null) return;
      const isSelected = rivals.includes(targetRosterId);
      if (!isSelected && rivals.length >= MAX_RIVALS) return;

      const next = isSelected
        ? rivals.filter((id) => id !== targetRosterId)
        : [...rivals, targetRosterId];

      await setMyRivals(MEDIA_CONFIG.season, rosterId, next);
      await queryClient.invalidateQueries({ queryKey: myRivalsQueryKey(rosterId) });
    },
    [rosterId, rivals, queryClient]
  );

  return { rivals, isLoading: query.isLoading, toggle };
}
