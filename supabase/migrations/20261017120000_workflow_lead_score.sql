-- Score CRM utilisé par les actions de workflow « Ajouter/Retirer du score ».
alter table public.leads
  add column if not exists lead_score integer not null default 0;

alter table public.leads
  drop constraint if exists leads_lead_score_non_negative;

alter table public.leads
  add constraint leads_lead_score_non_negative check (lead_score >= 0);

-- Mise à jour atomique : deux workflows simultanés ne peuvent pas écraser
-- mutuellement leur calcul. La fonction reste SECURITY INVOKER (valeur par
-- défaut) et n'est exécutable que par le rôle serveur.
create or replace function public.adjust_lead_score(
  p_user_id uuid,
  p_lead_id uuid,
  p_delta integer
)
returns integer
language sql
set search_path = ''
as $$
  update public.leads
  set lead_score = greatest(0, lead_score + p_delta)
  where id = p_lead_id
    and user_id = p_user_id
  returning lead_score;
$$;

revoke all on function public.adjust_lead_score(uuid, uuid, integer) from public;
revoke all on function public.adjust_lead_score(uuid, uuid, integer) from anon;
revoke all on function public.adjust_lead_score(uuid, uuid, integer) from authenticated;
grant execute on function public.adjust_lead_score(uuid, uuid, integer) to service_role;

comment on column public.leads.lead_score is
  'Score comportemental CRM, ajusté par les workflows et toujours positif.';
