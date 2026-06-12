-- Phase 5D — public storage bucket for logos/graphics placed on the truck.
-- Public so the 3D viewer (and the customer share page) can load the texture
-- by URL. Apply via the Supabase MCP or SQL editor.

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

drop policy if exists "brand_assets_read" on storage.objects;
create policy "brand_assets_read" on storage.objects
  for select to public using (bucket_id = 'brand-assets');

drop policy if exists "brand_assets_write" on storage.objects;
create policy "brand_assets_write" on storage.objects
  for all to public
  using (bucket_id = 'brand-assets')
  with check (bucket_id = 'brand-assets');
