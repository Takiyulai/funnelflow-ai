-- db/storage-media-rls.sql
-- CAUSE RACINE du 404 à la publication (diagnostiquée en direct) :
-- le bucket storage "cloned-funnels-media" refuse les uploads d'images (RLS),
-- donc les images sont stockées INLINE en base64 dans json_content. Le tunnel
-- devient énorme et l'écriture Postgres time out :
--   [57014] canceling statement due to statement timeout
-- → la publication n'aboutit pas → page publique en 404.
--
-- Ce script autorise l'utilisateur connecté à uploader ses médias dans SON
-- dossier (chemin : <user_id>/<funnel_id>/<fichier>) et la lecture publique.
-- À exécuter dans Supabase → SQL Editor. Idempotent (ré-exécutable).
-- ─────────────────────────────────────────────────────────────────────────────

-- Le bucket doit exister et être public (lecture via URL publique).
update storage.buckets set public = true where id = 'cloned-funnels-media';

-- Upload (INSERT) : l'utilisateur ne peut écrire que dans son propre dossier.
drop policy if exists "ff_media_insert_own" on storage.objects;
create policy "ff_media_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cloned-funnels-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Remplacement (UPDATE) de ses propres médias.
drop policy if exists "ff_media_update_own" on storage.objects;
create policy "ff_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cloned-funnels-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Suppression (DELETE) de ses propres médias.
drop policy if exists "ff_media_delete_own" on storage.objects;
create policy "ff_media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cloned-funnels-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture PUBLIQUE des médias (les pages publiées chargent les images sans auth).
drop policy if exists "ff_media_read_public" on storage.objects;
create policy "ff_media_read_public" on storage.objects
  for select using (bucket_id = 'cloned-funnels-media');
