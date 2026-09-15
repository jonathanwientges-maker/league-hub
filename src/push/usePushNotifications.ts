import { useCallback, useEffect, useState } from "react";
import { MEDIA_CONFIG } from "../media/config";
import { getCurrentSubscription, getPushSupport, subscribe, toRecord, unsubscribe } from "./pushClient";
import { removeSubscription, saveSubscription } from "./api";

export type PushStatus = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

export function usePushNotifications(rosterId: number | null) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const support = getPushSupport();
    if (support !== "supported") {
      setStatus(support);
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    getCurrentSubscription()
      .then((sub) => { if (!cancelled) setStatus(sub ? "on" : "off"); })
      .catch(() => { if (!cancelled) setStatus("unsupported"); });
    return () => { cancelled = true; };
  }, []);

  // Keep the stored roster in sync when the manager switches team on this device.
  useEffect(() => {
    if (status !== "on") return;
    getCurrentSubscription()
      .then((sub) => (sub ? saveSubscription(toRecord(sub), rosterId, MEDIA_CONFIG.season) : undefined))
      .catch(() => { /* best effort; next enable() re-saves */ });
  }, [rosterId, status]);

  const enable = useCallback(async () => {
    setError(null);
    try {
      const sub = await subscribe();
      await saveSubscription(toRecord(sub), rosterId, MEDIA_CONFIG.season);
      setStatus("on");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("permission:")) setStatus("denied");
      else setError("Aktivierung fehlgeschlagen. Bitte später erneut versuchen.");
    }
  }, [rosterId]);

  const disable = useCallback(async () => {
    setError(null);
    try {
      const endpoint = await unsubscribe();
      if (endpoint) await removeSubscription(endpoint);
      setStatus("off");
    } catch {
      setError("Deaktivierung fehlgeschlagen.");
    }
  }, []);

  return { status, error, enable, disable };
}
