# Checklist de déploiement — AutoFunnel AI

Récapitulatif de tout ce qui a été développé pendant ces sessions et de ce qu'il
faut faire pour le mettre en production **sans surprise**.

---

## 1. Migrations base de données — ✅ DÉJÀ APPLIQUÉES EN PROD

Rien à refaire (appliquées directement sur le projet Supabase `xhjhdheskjwbmdjzazoq`) :

| Migration | Contenu |
|---|---|
| `template_likes` | Colonne `shared_templates.like_count` + table `template_likes` (RLS) |
| `leads_unsubscribe` | Colonnes `leads.unsubscribed_at` + `leads.unsubscribe_token` + index d'exclusion |

Données (grants testeurs bêta Agency, déjà faits) : `takiyulai0dramane@gmail.com`,
`dramanesuhaylah@gmail.com` (pro), `jwdemanou@gmail.com`, `aquilakadji2@gmail.com`.

> ⚠️ La table `shared_templates` et la Galerie sont déjà en prod ; c'est le **code**
> qui n'est pas encore déployé.

---

## 2. Variables d'environnement à poser sur Vercel (Production **et** Preview)

### À AJOUTER (nouvelles)
| Variable | Rôle | Obligatoire ? |
|---|---|---|
| `OPENROUTER_CHATBOT_API_KEY` | Clé DÉDIÉE du chatbot (modèles gratuits). **Jamais** `OPENROUTER_API_KEY`. Serveur only. | Oui (sinon le chatbot renvoie juste le message de repli) |
| `AI_KILL_SWITCH` | Coupe TOUTE génération IA payante si = `1`. **À ne poser qu'en cas d'urgence** (budget/abus). | Non (absente = IA active) |
| `OPENROUTER_CHATBOT_MODELS` | Override des modèles `:free` du chatbot (liste séparée par virgules), sans redéployer. | Non |

### À VÉRIFIER (déjà censées exister)
`NEXT_PUBLIC_SITE_URL` (indispensable : liens de tracking **et de désinscription**),
`CRON_SECRET` (protège le cron d'emails), `SUPABASE_SERVICE_ROLE_KEY`,
`OPENAI_API_KEY` (génération payante), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
clés CinetPay/Chariow, `RESEND_API_KEY`, `SCRAPINGBEE` (clonage).

---

## 3. Déploiement

1. En local : `npm run build` (≈ 7 min). **S'arrête au 1er type-error** → corrige et relance.
2. `git add -A && git commit -m "…" && git push`
3. Redeploy Vercel (auto sur push, ou manuel).
4. Poser les variables d'env (section 2) **avant** ou juste après, puis redeploy si ajoutées après.

---

## 4. Vérifications post-déploiement (rapides)

- [ ] **Galerie** : s'affiche nette, miniatures OK, like fonctionne, « Utiliser » clone.
- [ ] **Éditeur d'un tunnel cloné** : clic sur un élément ouvre bien le panneau d'édition ; pas de bande vide sous le footer.
- [ ] **Chatbot** (bas-droite) : répond depuis la doc ; question compte → renvoie email + WhatsApp.
- [ ] **Dashboard** : 3 tunnels + « Voir plus » ; bandeau KPI emails ; pas d'email dans l'en-tête ; jours restants dans la sidebar.
- [ ] **Stats emails** : bandeau en haut de l'onglet Emails.
- [ ] **Workflow → action « Envoyer un email »** : bouton « Générer avec l'IA » remplit objet + contenu.
- [ ] **Micro-victoires** : générer un tunnel / publier / 1er lead → modale + confettis (une seule fois).
- [ ] **RGPD** : un email de campagne contient le lien « Se désinscrire » ; cliquer → page de confirmation + le contact n'est plus contacté. Page `/abonnement` → « Zone de danger » présente.
- [ ] **Kill-switch** : (test ponctuel) poser `AI_KILL_SWITCH=1`, tenter une génération → message de repli ; puis retirer la variable.

---

## 5. Sécurité — état après ces sessions

| Point d'audit | Statut |
|---|---|
| RLS multi-tenant (isolation par `user_id`) | ✅ Vérifié solide |
| Paiements vérifiés serveur + webhooks idempotents | ✅ Vérifié |
| #1 XSS via templates galerie | ✅ Corrigé (sanitisation au partage) |
| #3 Kill-switch dépense IA | ✅ Ajouté (`AI_KILL_SWITCH`) |
| #4 IDOR routes `service_role` | ✅ Audit PASS (aucune faille) |
| #2 RGPD (désinscription + suppression compte) | ✅ Implémenté |
| **#1b Durcir le sandbox iframe** (`allow-same-origin`) | ⏳ **À FAIRE** (barrière première, risqué : nécessite mesure de hauteur en `postMessage` + vérif visuelle) |

---

## 6. À prévoir ensuite (non bloquant pour déployer)

- **#1b** : retirer `allow-same-origin` des iframes raw-html (le plus important restant).
- En-tête **`List-Unsubscribe`** (désinscription 1-clic native Gmail/Yahoo) dans Resend.
- **Tests d'intégration** critiques (paiements/webhooks, RLS, publication) — couverture ~0 aujourd'hui.
- Simplifier le store tunnels (Supabase = source de vérité).
- **Versioning de publication** (rollback), **ISR/CDN** sur les pages publiques, **file de jobs** pour les emails à l'échelle.

---

*Voir `AUDIT_TECHNIQUE_FunnelFlow.md` pour le détail complet des risques et priorités.*
