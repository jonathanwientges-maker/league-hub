import { supabase } from "../media/supabaseClient";
import type { SubscriptionRecord } from "./pushClient";

export async function saveSubscription(record: SubscriptionRecord, rosterId: number | null, season: string): Promise<void> {
  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_endpoint: record.endpoint,
    p_p256dh: record.p256dh,
    p_auth: record.auth,
    p_roster_id: rosterId,
    p_season: season,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  if (error) throw error;
}
