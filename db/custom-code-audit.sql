-- db/custom-code-audit.sql
-- 🆕 VAGUE CUSTOM-CODE — Traçabilité du code personnalisé (exigence n°5).
-- À exécuter dans Supabase → SQL Editor (idempotent).
--
-- Un TRIGGER sur public.funnels journalise automatiquement quel utilisateur /
-- quel tunnel contient du code personnalisé (brouillon ET publié), avec les
-- tailles. Inviolable côté client : le trigger tourne en base quel que soit le
-- chemin d'écriture (client browser, admin, SQL direct).
--
-- Lecture : service role uniquement (RLS activée SANS policy → aucun accès
-- client). Audit typique :
--   select * from custom_code_audit order by updated_at desc;

create table if not exists public.custom_code_audit (
  funnel_id uuid primary key,
  user_id uuid not null,
  -- Tailles (0 = zone vide) — contenu NON copié ici : il reste dans funnels,
  -- l'audit ne sert qu'à savoir OÙ regarder en cas d'abus signalé.
  published_head_len int not null default 0,
  published_body_len int not null default 0,
  draft_head_len int not null default 0,
  draft_body_len int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.custom_code_audit enable row level security;
-- (aucune policy : lecture/écriture service role uniquement)

-- SECURITY DEFINER : le trigger doit pouvoir écrire dans la table d'audit
-- même quand le DML vient d'un client authentifié (RLS sans policy sinon).
create or replace function public.log_custom_code_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p_head text := coalesce(new.published_content -> 'customCode' ->> 'head', '');
  p_body text := coalesce(new.published_content -> 'customCode' ->> 'body', '');
  d_head text := coalesce(new.json_content -> 'customCode' ->> 'head', '');
  d_body text := coalesce(new.json_content -> 'customCode' ->> 'body', '');
begin
  if length(p_head) > 0 or length(p_body) > 0
     or length(d_head) > 0 or length(d_body) > 0 then
    insert into public.custom_code_audit as a
      (funnel_id, user_id, published_head_len, published_body_len,
       draft_head_len, draft_body_len, updated_at)
    values
      (new.id, new.user_id, length(p_head), length(p_body),
       length(d_head), length(d_body), now())
    on conflict (funnel_id) do update
      set user_id = excluded.user_id,
          published_head_len = excluded.published_head_len,
          published_body_len = excluded.published_body_len,
          draft_head_len = excluded.draft_head_len,
          draft_body_len = excluded.draft_body_len,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists funnels_custom_code_audit on public.funnels;
create trigger funnels_custom_code_audit
  after insert or update of json_content, published_content
  on public.funnels
  for each row
  execute function public.log_custom_code_audit();
