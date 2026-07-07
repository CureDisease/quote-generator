-- Phase 6 — sales workspace: per-quote sales notes and follow-up reminders.
-- Apply via the Supabase MCP (apply_migration) or the SQL editor.

alter table public.quotes
  add column if not exists sales_notes text not null default '',
  add column if not exists follow_up_at timestamptz;
