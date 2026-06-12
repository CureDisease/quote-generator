import { createClient } from "@supabase/supabase-js";

// This is an internal test dashboard. The Supabase URL + publishable (anon)
// key are safe to ship in the client/build — RLS governs access — so we bake
// working defaults in and allow env overrides. Set SUPABASE_URL /
// SUPABASE_ANON_KEY in the environment to point at a different project.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://efztaxrhinpfbxvwxrlq.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "sb_publishable_oOOA9HweZyqQX-eFXXDFvQ_eOTjDvn9";

export function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}
