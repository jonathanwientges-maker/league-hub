import { useCallback, useState } from "react";
import { clearIdentity as removeIdentity, getIdentity, setIdentity as persistIdentity } from "./identity";

export function useIdentity() {
  const [rosterId, setRosterId] = useState<number | null>(() => getIdentity());

  const setIdentity = useCallback((id: number) => {
    persistIdentity(id);
    setRosterId(id);
  }, []);

  const clearIdentity = useCallback(() => {
    removeIdentity();
    setRosterId(null);
  }, []);

  return { rosterId, setIdentity, clearIdentity };
}
