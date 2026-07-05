# Délivrabilité Email — AutoFunnel AI (Resend)

Ce document explique comment passer du **mode test** à un **domaine vérifié** dans
Resend, pour que les emails (système + marketing) partent sans tomber en spam.
Les valeurs exactes des enregistrements DNS sont **générées par Resend** quand tu
ajoutes ton domaine — copie-les depuis l'onglet **Records** du dashboard.

> ⚠️ Ces étapes sont **manuelles** (dashboard Resend + DNS), pas du code.

---

## 1. Pourquoi c'est nécessaire

- **Mode test actuel** (`onboarding@resend.dev`) : Resend **ne livre qu'à l'adresse
  email du propriétaire du compte Resend**. Impossible d'écrire à tes vrais
  contacts. C'est uniquement pour tester l'intégration.
- **Production** : il faut un **domaine vérifié** dans Resend. Une fois vérifié,
  tu peux envoyer à n'importe qui, depuis une adresse `@tondomaine.com`.
- Un expéditeur `@gmail.com` / `@outlook.com` est **refusé** par Resend.

---

## 2. Étapes manuelles dans le dashboard Resend

1. **Resend → Domains → Add Domain.** Saisis ton domaine d'envoi
   (ex. `funnelflow.ai`, ou un sous-domaine dédié comme `mail.funnelflow.ai` —
   recommandé pour isoler la réputation d'envoi).
2. Resend affiche, dans l'onglet **Records**, les enregistrements DNS à créer
   (SPF/Return-Path, MX, DKIM, et DMARC suggéré).
3. **Ajoute ces enregistrements chez ton hébergeur DNS** (registrar, Cloudflare,
   Vercel DNS, etc.) — copie les valeurs **exactement** comme affichées.
4. Reviens sur Resend et clique **Check DNS / Verify**. La propagation peut
   prendre jusqu'à **24 h** (Resend re-teste pendant 72 h). Statut cible :
   **Verified**.
5. (Optionnel mais conseillé) Crée une **API key restreinte à l'envoi** pour ce
   domaine et mets-la dans `RESEND_API_KEY`.

---

## 3. Les enregistrements DNS (rôles + forme type)

> Les valeurs ci-dessous sont des **exemples** ; prends les valeurs réelles dans
> l'onglet Records de Resend (la clé DKIM et la région SES sont propres à ton
> domaine).

### a) SPF / Return-Path — TXT sur le sous-domaine `send`
Autorise les serveurs Resend/SES à envoyer pour ton domaine.
```
Type: TXT
Nom : send.tondomaine.com
Val : v=spf1 include:amazonses.com ~all
```

### b) MX (bounces / plaintes) — sur le même sous-domaine `send`
Permet à Resend de recevoir les retours (bounces, plaintes).
```
Type: MX
Nom : send.tondomaine.com
Val : feedback-smtp.<region>.amazonses.com   (priorité 10)
```
(`<region>` = celle affichée par Resend, ex. `us-east-1`, `eu-west-1`.)

### c) DKIM — TXT (signature cryptographique)
Prouve que l'email vient bien de ton domaine et n'a pas été altéré.
```
Type: TXT
Nom : resend._domainkey.tondomaine.com
Val : p=<clé publique fournie par Resend>
```

### d) DMARC — TXT (politique anti-usurpation) — fortement recommandé
Indique aux boîtes mail quoi faire si SPF/DKIM échouent + reçoit des rapports.
```
Type: TXT
Nom : _dmarc.tondomaine.com
Val : v=DMARC1; p=none; rua=mailto:dmarc@tondomaine.com
```
Commence par `p=none` (observation), puis durcis vers `p=quarantine` puis
`p=reject` une fois que tout est vert depuis quelques semaines.

---

## 4. Brancher le domaine vérifié dans l'app

Une fois le domaine **Verified** dans Resend, configure les variables d'env
(`.env.local` **et** Vercel → Settings → Environment Variables, Production + Preview) :

```dotenv
RESEND_API_KEY=re_...                         # clé Resend
RESEND_FROM_EMAIL=noreply@tondomaine.com      # adresse @ domaine vérifié
RESEND_FROM_NAME=AutoFunnel AI                 # nom affiché
```

- Les **emails système** (confirmation d'achat, notifications) partent **toujours**
  depuis cette adresse AutoFunnel (`getSystemSender()`).
- Les **emails marketing** des utilisateurs partent depuis ce **même domaine
  partagé**, avec un nom `« <Nom du créateur> via AutoFunnel »` et un **reply-to**
  vers l'email réel du créateur (résolu par `getUserMarketingSender()`).
- L'ancienne variable combinée `RESEND_FROM="Nom <email>"` reste lue en repli
  (compatibilité) ; tu peux la retirer une fois les deux ci-dessus en place.

---

## 5. Domaines personnalisés par utilisateur (premium — à venir)

Le schéma le supporte déjà (`profiles.custom_email_from`, `custom_email_domain`,
`custom_email_status`). Quand cette feature sera activée :
- chaque utilisateur ajoutera **son propre domaine** dans Resend (mêmes
  enregistrements SPF/DKIM/MX/DMARC sur SON domaine) ;
- une fois `custom_email_status = 'verified'`, `getUserMarketingSender()` enverra
  automatiquement depuis **son** adresse au lieu du domaine AutoFunnel partagé.

L'UI de configuration + le flux de vérification (via l'API Domains de Resend)
restent à construire ; l'architecture d'envoi n'aura **pas** à être refaite.

---

## 6. Checklist rapide

- [ ] Domaine ajouté dans Resend, statut **Verified**.
- [ ] SPF (TXT), MX, DKIM (TXT), DMARC (TXT) créés chez le DNS.
- [ ] `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` définies (local + Vercel).
- [ ] Test d'envoi à une adresse **externe** (pas seulement celle du compte Resend).
- [ ] DMARC durci progressivement (`none` → `quarantine` → `reject`).
