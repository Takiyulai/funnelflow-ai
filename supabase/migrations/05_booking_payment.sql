-- supabase/migrations/05_booking_payment.sql
--
-- 🆕 RENDEZ-VOUS ET ATELIERS PAYANTS, via Chariow.
--
-- ── L'APPROCHE : PAYER PUIS RÉSERVER ───────────────────────────────────────
-- Le visiteur paie sur Chariow, et le `redirect_url` du produit Chariow le
-- ramène sur la page de réservation. Seuls ceux qui ont payé atteignent le
-- calendrier.
--
-- L'alternative — réserver puis payer, avec un statut `pending_payment` et une
-- confirmation par webhook — a été écartée pour une raison précise : le Pulse
-- Chariow (`successful.sale`) livre `customer.email`, `product.id` et
-- `sale.id`, mais AUCUN identifiant que nous aurions injecté dans la
-- transaction. Corréler une vente avec une réservation précise ne serait
-- possible que par email + produit + fenêtre de temps — indiscernable dès que
-- le même client réserve deux fois le même jour. Un échec de corrélation
-- laisserait un créneau bloqué ET un client ayant payé sans rendez-vous.
--
-- Conséquence assumée : quelqu'un qui connaît l'URL de réservation peut
-- réserver sans payer. Acceptable pour un lien diffusé dans un tunnel ; à
-- fermer plus tard par un jeton d'accès à usage unique dans le redirect_url.
--
-- ── PAS DE CLÉ API ─────────────────────────────────────────────────────────
-- L'utilisateur colle l'URL publique de son produit Chariow. Pas de clé à
-- stocker, pas de permission à accorder, et chaque utilisateur reste sur SON
-- propre store — ce qu'une intégration par clé unique aurait rendu impossible.

-- ── 1. Réglages de paiement du type de rendez-vous ─────────────────────────
alter table public.booking_event_types
  add column if not exists payment_required boolean not null default false;

-- Montant en UNITÉ ENTIÈRE de la devise (centimes pour EUR/USD).
-- Stocker un entier évite les erreurs d'arrondi des flottants sur l'argent.
alter table public.booking_event_types
  add column if not exists price_amount integer;

alter table public.booking_event_types
  add column if not exists currency text not null default 'EUR';

-- URL publique du produit Chariow. C'est la SEULE information nécessaire :
-- Chariow gère l'encaissement, la facture et la redirection.
alter table public.booking_event_types
  add column if not exists payment_url text;

-- Prépare l'arrivée d'autres passerelles sans nouvelle migration.
alter table public.booking_event_types
  add column if not exists payment_provider text not null default 'chariow';

alter table public.booking_event_types
  drop constraint if exists booking_event_types_payment_provider_check;

alter table public.booking_event_types
  add constraint booking_event_types_payment_provider_check
  check (payment_provider in ('chariow', 'external'));

alter table public.booking_event_types
  drop constraint if exists booking_event_types_price_check;

alter table public.booking_event_types
  add constraint booking_event_types_price_check
  check (price_amount is null or price_amount >= 0);

comment on column public.booking_event_types.payment_url is
  'URL publique du produit Chariow. Le redirect_url de CE produit doit pointer vers la page de réservation AutoFunnel.';
comment on column public.booking_event_types.price_amount is
  'Montant en centimes. Affichage seul : le prix réellement encaissé est celui du produit Chariow.';

-- ── 2. Prix par SÉANCE (mode event) ────────────────────────────────────────
-- Un cycle d'ateliers peut proposer une séance d'ouverture gratuite et les
-- suivantes payantes. NULL → on retombe sur le prix du type.
alter table public.booking_sessions
  add column if not exists price_amount integer;

alter table public.booking_sessions
  add column if not exists payment_url text;

comment on column public.booking_sessions.price_amount is
  'Surcharge le prix du type pour cette séance. NULL = prix du type.';
