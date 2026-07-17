import { useQuery } from "@tanstack/react-query";
import { getDraftPicks } from "../api/sleeper";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useDraftPicks(draftId: string | undefined) {
  return useQuery({
    queryKey: ["draftPicks", draftId],
    queryFn: () => getDraftPicks(draftId!),
    staleTime: FIVE_MINUTES_MS,
    enabled: Boolean(draftId),
  });
}
