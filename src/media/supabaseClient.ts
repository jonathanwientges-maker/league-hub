import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Media Room: VITE_SUPABASE_URL und/oder VITE_SUPABASE_ANON_KEY fehlen. " +
      "Bitte in .env (lokal) bzw. in den Vercel-Umgebungsvariablen setzen."
  );
}

// createClient() throws synchronously on an empty URL — since the rest of the
// SPA (Home's Media Day banner etc.) imports this module transitively, a
// missing/misconfigured .env must not crash every other page. A syntactically
// valid placeholder lets the client construct; actual requests then just fail
// (already the expected state when unconfigured), instead of the whole app.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder");
