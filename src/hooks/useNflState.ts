import { useQuery } from "@tanstack/react-query";
import { getNflState } from "../api/sleeper";

const ONE_MINUTE_MS = 60 * 1000;

export function useNflState() {
  return useQuery({
    queryKey: ["nflState"],
    queryFn: () => getNflState(),
    staleTime: ONE_MINUTE_MS,
  });
}
