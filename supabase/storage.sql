-- ============================================================
-- AutoFunnel AI - Storage buckets et policies
-- ============================================================

-- Bucket pour les logos et assets de marque
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

-- Bucket pour les images de section uploadées
insert into storage.buckets (id, name, public)
values ('section-images', 'section-images', true)
on conflict (id) do nothing;

-- Bucket pour les exports HTML / ZIP
insert into storage.buckets (id, name, public)
values ('funnel-exports', 'funnel-exports', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Policies brand-assets (lecture publique, écriture proprio)
-- ------------------------------------------------------------
drop policy if exists "Brand assets are readable" on storage.objects;
create policy "Brand assets are readable" on storage.objects
  for select using (bucket_id = 'brand-assets');

drop policy if exists "Users upload brand assets in own folder" on storage.objects;
create policy "Users upload brand assets in own folder" on storage.objects
  for insert with check (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own brand assets" on storage.objects;
create policy "Users update own brand assets" on storage.objects
  for update using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own brand assets" on storage.objects;
create policy "Users delete own brand assets" on storage.objects
  for delete using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------------------------------------------------------
-- Policies section-images (lecture publique, écriture proprio)
-- ------------------------------------------------------------
drop policy if exists "Section images are readable" on storage.objects;
create policy "Section images are readable" on storage.objects
  for select using (bucket_id = 'section-images');

drop policy if exists "Users upload section images in own folder" on storage.objects;
create policy "Users upload section images in own folder" on storage.objects
  for insert with check (
    bucket_id = 'section-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own section images" on storage.objects;
create policy "Users update own section images" on storage.objects
  for update using (
    bucket_id = 'section-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own section images" on storage.objects;
create policy "Users delete own section images" on storage.objects
  for delete using (
    bucket_id = 'section-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------------------------------------------------------
-- Policies funnel-exports (privé, accès via signed URL)
-- ------------------------------------------------------------
drop policy if exists "Users read own exports" on storage.objects;
create policy "Users read own exports" on storage.objects
  for select using (
    bucket_id = 'funnel-exports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users upload own exports" on storage.objects;
create policy "Users upload own exports" on storage.objects
  for insert with check (
    bucket_id = 'funnel-exports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own exports" on storage.objects;
create policy "Users delete own exports" on storage.objects
  for delete using (
    bucket_id = 'funnel-exports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
