"use client";

// components/funnel/PublicFunnelRuntime.tsx
// Runtime exécuté sur les pages publiques (/tunnel/[slug]). Le HTML du tunnel
// est injecté via dangerouslySetInnerHTML — or les <script> ainsi insérés ne
// s'exécutent PAS. Ce composant reproduit donc le comportement côté React :
//  - capture des formulaires (.ff-form-fields) → POST /api/leads
//  - redirection vers la page suivante (data-ff-next-url) après soumission
//  - ouverture/fermeture du popup interne ([data-ff-popup-open] / overlay)

import { useEffect } from "react";

type LeadPayload = {
  metadata: Record<string, unknown>;
  email?: string;
  name?: string;
  phone?: string;
  consent?: boolean;
  funnelSlug?: string;
  pageSlug?: string | null;
  sectionId?: string | null;
  tags?: string[];
};

export default function PublicFunnelRuntime() {
  useEffect(() => {
    function collect(form: HTMLFormElement): LeadPayload {
      const d: LeadPayload = { metadata: {} };
      const els = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input,textarea,select",
      );
      els.forEach((el) => {
        if (!el.name) return;
        const n = el.name.toLowerCase();
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          if (n.includes("consent") || n.includes("rgpd")) d.consent = el.checked;
          else d.metadata[el.name] = el.checked;
          return;
        }
        const v = (el as HTMLInputElement).value;
        const type = el instanceof HTMLInputElement ? el.type : "";
        if (n === "email" || type === "email") d.email = v;
        else if (!d.name && ["name", "nom", "prenom", "firstname", "fullname"].includes(n)) d.name = v;
        else if (n === "phone" || n === "tel" || n === "telephone" || type === "tel") d.phone = v;
        else d.metadata[el.name] = v;
      });
      return d;
    }

    function success(form: HTMLFormElement, next: string | null) {
      if (next) {
        window.location.href = next;
      } else {
        form.innerHTML = `<p class="ff-reassurance">Merci, c'est bien reçu&nbsp;!</p>`;
      }
    }

    function onSubmit(this: HTMLFormElement, e: Event) {
      e.preventDefault();
      const form = this;
      const slug = form.getAttribute("data-ff-funnel-slug");
      const next = form.getAttribute("data-ff-next-url");
      const btn = form.querySelector<HTMLButtonElement>("[type=submit]");
      const d = collect(form);
      if (!d.email) return;
      if (!slug) {
        success(form, next);
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.dataset.l = btn.textContent || "";
        btn.textContent = "…";
      }
      d.funnelSlug = slug;
      d.pageSlug = form.getAttribute("data-ff-page-slug");
      d.sectionId = form.getAttribute("data-ff-section-id");
      const tagsRaw = form.getAttribute("data-ff-tags");
      if (tagsRaw) d.tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      })
        .then((r) => r.json().then((j) => ({ s: r.ok, j })).catch(() => ({ s: r.ok, j: {} as { ok?: boolean } })))
        .then((res) => {
          if (res.s && res.j && (res.j as { ok?: boolean }).ok) {
            success(form, next);
          } else {
            if (btn) {
              btn.disabled = false;
              btn.textContent = btn.dataset.l || "Envoyer";
            }
            alert("Une erreur est survenue, réessayez.");
          }
        })
        .catch(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = btn.dataset.l || "Envoyer";
          }
          alert("Connexion impossible, réessayez.");
        });
    }

    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form.ff-form-fields"));
    forms.forEach((f) => f.addEventListener("submit", onSubmit));

    const overlay = document.querySelector<HTMLElement>("[data-ff-popup-overlay]");
    const openers = Array.from(document.querySelectorAll<HTMLElement>("[data-ff-popup-open]"));
    function openPopup(e: Event) {
      if (!overlay) return;
      e.preventDefault();
      overlay.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    }
    function closePopup() {
      if (!overlay) return;
      overlay.setAttribute("hidden", "");
      document.body.style.overflow = "";
    }
    function onOverlayClick(e: MouseEvent) {
      if (e.target === overlay) closePopup();
    }
    if (overlay) {
      openers.forEach((b) => b.addEventListener("click", openPopup));
      overlay.addEventListener("click", onOverlayClick);
      overlay
        .querySelectorAll<HTMLElement>("[data-ff-popup-close]")
        .forEach((c) => c.addEventListener("click", closePopup));
    }

    // ─── Checkout natif (Palier 2) ─────────────────────────────────────────
    // Un CTA dont le lien est `#ff-checkout` (ou qui porte data-ff-checkout)
    // déclenche une session Stripe Checkout via /api/checkout, puis redirige.
    function slugFromPath(): string {
      const m = window.location.pathname.match(/\/tunnel\/([^/]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    }
    // Page courante (segment après le slug) → permet de calculer l'étape
    // suivante du tunnel après le paiement. Null sur la page d'accueil.
    function pageSlugFromPath(): string | null {
      const m = window.location.pathname.match(/\/tunnel\/[^/]+\/([^/]+)/);
      if (!m) return null;
      const seg = decodeURIComponent(m[1]);
      // Exclure les pages techniques du tunnel.
      if (["success", "cancel", "merci"].includes(seg)) return null;
      return seg;
    }
    const checkoutTriggers = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href="#ff-checkout"], a[href$="/api/checkout"], [data-ff-checkout]',
      ),
    );
    async function onCheckout(this: HTMLElement, e: Event) {
      e.preventDefault();
      const btn = this;
      if (btn.getAttribute("data-ff-loading") === "1") return;
      btn.setAttribute("data-ff-loading", "1");
      const label = btn.textContent;
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ funnelSlug: slugFromPath(), pageSlug: pageSlugFromPath() }),
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string };
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        alert("Le paiement n'est pas disponible pour le moment.");
      } catch {
        alert("Connexion impossible, réessayez.");
      } finally {
        btn.removeAttribute("data-ff-loading");
        if (label) btn.textContent = label;
      }
    }
    checkoutTriggers.forEach((b) => b.addEventListener("click", onCheckout));

    // ─── FAQ accordéon générique (tunnels clonés) ──────────────────────────
    // Le markup cloné (systeme.io…) n'a pas de data-attr FunnelFlow. On détecte
    // les questions (texte court terminé par « ? ») et on replie la réponse
    // (bloc frère plus long) → clic pour ouvrir/fermer.
    const faqCleanups: Array<() => void> = [];
    function answerOf(q: Element): HTMLElement | null {
      let n = q.nextElementSibling as HTMLElement | null;
      while (n) {
        if ((n.textContent || "").trim().length >= 40) return n;
        n = n.nextElementSibling as HTMLElement | null;
      }
      const p = q.parentElement;
      const sib = p?.nextElementSibling as HTMLElement | null;
      if (sib && (sib.textContent || "").trim().length >= 40) return sib;
      return null;
    }
    const faqCandidates = Array.from(
      document.querySelectorAll<HTMLElement>("p,div,h3,h4,h5,strong,span"),
    );
    faqCandidates.forEach((q) => {
      if (q.getAttribute("data-ff-faq-bound") === "1") return;
      if (q.children.length > 3) return;
      const qt = (q.textContent || "").trim();
      if (!(qt.length > 4 && qt.length < 200 && /\?\s*$/.test(qt))) return;
      const a = answerOf(q);
      if (!a) return;
      const at = (a.textContent || "").trim();
      if (!(at.length >= 40 && at.length > qt.length && at !== qt)) return;
      q.setAttribute("data-ff-faq-bound", "1");
      q.style.cursor = "pointer";
      a.style.display = "none";
      const onToggle = (e: Event) => {
        e.preventDefault();
        const open = a.style.display !== "none";
        a.style.display = open ? "none" : "block";
      };
      q.addEventListener("click", onToggle);
      faqCleanups.push(() => q.removeEventListener("click", onToggle));
    });

    return () => {
      forms.forEach((f) => f.removeEventListener("submit", onSubmit));
      if (overlay) {
        openers.forEach((b) => b.removeEventListener("click", openPopup));
        overlay.removeEventListener("click", onOverlayClick);
      }
      checkoutTriggers.forEach((b) => b.removeEventListener("click", onCheckout));
      faqCleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
