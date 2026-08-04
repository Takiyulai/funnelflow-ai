// tests/accordion-runtime.test.ts
//
// Runtime accordéon/FAQ des sections clonées.
//
// Le clonage retire tous les <script> de la page source. Les constructeurs de
// pages masquent la réponse par une CLASSE CSS et la révèlent par JS : sans ce
// runtime, les réponses restent invisibles ET rien ne réagit au clic.
//
// Cas réels ayant motivé ces tests (page Divi 4.11 clonée par un utilisateur) :
//   - le titre est un <h5> SANS icône enfant → le chemin « chevron » échouait ;
//   - les 7 questions finissaient par « ? 👇 » → le test /\?\s*$/ échouait
//     sur les 7, l'emoji venant APRÈS le point d'interrogation.
//
// jsdom ne calcule pas la mise en page, mais le runtime pilote par STYLE
// INLINE : les assertions portent donc sur `element.style`, fidèlement reflété.

import { describe, it, expect, beforeEach } from "vitest";
import {
  ACCORDION_RUNTIME_SCRIPT,
  ACCORDION_EDIT_REVEAL_CSS,
  SCROLL_ANIMATION_REVEAL_CSS,
} from "@/lib/clone/accordion-runtime";
import { FAQ_RUNTIME_SCRIPT } from "@/lib/export/faq-script";

/** Exécute le runtime dans le document jsdom courant. */
function bootRuntime(): void {
  const code = ACCORDION_RUNTIME_SCRIPT.replace(/^<script>/, "").replace(/<\/script>$/, "");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(code)();
}

/** Markup Divi authentique (relevé sur la page clonée). */
function diviFaq(questions: string[]): string {
  return questions
    .map(
      (q, i) => `
    <div class="et_pb_module et_pb_toggle et_pb_toggle_${i} et_pb_toggle_item et_pb_toggle_close">
      <h5 class="et_pb_toggle_title">${q}</h5>
      <div class="et_pb_toggle_content clearfix"><p>Réponse détaillée numéro ${i}, suffisamment longue pour être considérée comme une vraie réponse.</p></div>
    </div>`,
    )
    .join("");
}

const DIVI_QUESTIONS = [
  "¿CUANTO TIEMPO ME TOMARÁ COMPLETAR EL CURSO?  👇",
  "NECESITO EXPERIENCIA PREVIA PARA TOMAR ESTE CURSO?   👇",
  "¿QUÉ MATERIALES NECESITO PARA TOMAR EL CURSO?  👇",
  "¿EL PAGO ES SEGURO?  👇",
];

describe("runtime accordéon", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as unknown as Record<string, unknown>).__ffAccordionBooted;
  });

  it("lie les toggles Divi malgré l'absence d'icône enfant", () => {
    document.body.innerHTML = diviFaq(DIVI_QUESTIONS);
    bootRuntime();

    const titles = document.querySelectorAll<HTMLElement>(".et_pb_toggle_title");
    expect(titles).toHaveLength(4);
    titles.forEach((t) => {
      expect(t.getAttribute("data-ff-faq-question")).toBe("true");
      expect(t.style.cursor).toBe("pointer");
    });
  });

  it("replie les réponses par défaut puis les ouvre au clic", () => {
    document.body.innerHTML = diviFaq(DIVI_QUESTIONS);
    bootRuntime();

    const title = document.querySelector<HTMLElement>(".et_pb_toggle_title")!;
    const answer = document.querySelector<HTMLElement>(".et_pb_toggle_content")!;

    expect(answer.style.display).toBe("none");

    title.click();
    expect(answer.style.display).toBe("block");
    expect(title.getAttribute("data-ff-faq-open")).toBe("true");
    expect(title.getAttribute("aria-expanded")).toBe("true");

    title.click();
    expect(answer.style.display).toBe("none");
    expect(title.getAttribute("data-ff-faq-open")).toBe("false");
  });

  it("bascule les classes du constructeur pour que son propre style suive", () => {
    document.body.innerHTML = diviFaq(DIVI_QUESTIONS);
    bootRuntime();

    const item = document.querySelector<HTMLElement>(".et_pb_toggle")!;
    const title = item.querySelector<HTMLElement>(".et_pb_toggle_title")!;

    expect(item.classList.contains("et_pb_toggle_close")).toBe(true);

    title.click();
    expect(item.classList.contains("et_pb_toggle_open")).toBe(true);
    expect(item.classList.contains("et_pb_toggle_close")).toBe(false);
  });

  it("ouvre chaque question indépendamment des autres", () => {
    document.body.innerHTML = diviFaq(DIVI_QUESTIONS);
    bootRuntime();

    const titles = document.querySelectorAll<HTMLElement>(".et_pb_toggle_title");
    const answers = document.querySelectorAll<HTMLElement>(".et_pb_toggle_content");

    titles[2].click();
    expect(answers[2].style.display).toBe("block");
    expect(answers[0].style.display).toBe("none");
    expect(answers[1].style.display).toBe("none");
  });

  it("gère aussi le markup Elementor", () => {
    document.body.innerHTML = `
      <div class="elementor-accordion-item">
        <div class="elementor-tab-title">Quelle est la durée de la formation ?</div>
        <div class="elementor-tab-content"><p>Une réponse assez longue pour compter comme une vraie réponse utilisateur.</p></div>
      </div>`;
    bootRuntime();

    const title = document.querySelector<HTMLElement>(".elementor-tab-title")!;
    const content = document.querySelector<HTMLElement>(".elementor-tab-content")!;

    expect(content.style.display).toBe("none");
    title.click();
    expect(content.style.display).toBe("block");
  });

  it("ne lie jamais deux fois le même élément", () => {
    document.body.innerHTML = diviFaq(DIVI_QUESTIONS);
    bootRuntime();

    const title = document.querySelector<HTMLElement>(".et_pb_toggle_title")!;
    const answer = document.querySelector<HTMLElement>(".et_pb_toggle_content")!;

    // Une seconde exécution ne doit pas doubler les écouteurs : sinon un clic
    // basculerait deux fois et l'accordéon paraîtrait inerte.
    delete (window as unknown as Record<string, unknown>).__ffAccordionBooted;
    bootRuntime();

    title.click();
    expect(answer.style.display).toBe("block");
  });

  it("repli heuristique : markup anonyme sans classe reconnue", () => {
    document.body.innerHTML = `
      <div>
        <p>Combien de temps dure l'accès ?</p>
        <div>L'accès est valable douze mois à compter de la date d'achat, sans limite de visionnage.</div>
      </div>`;
    bootRuntime();

    const q = document.querySelector<HTMLElement>("p")!;
    const a = document.querySelector<HTMLElement>("div div")!;

    expect(q.getAttribute("data-ff-faq-question")).toBe("true");
    q.click();
    expect(a.style.display).toBe("block");
  });

  it("ne prend pas un paragraphe ordinaire pour une question", () => {
    document.body.innerHTML = `
      <div>
        <p>Bienvenue sur notre formation en ligne.</p>
        <div>Un paragraphe descriptif quelconque, assez long pour dépasser le seuil des quarante caractères.</div>
      </div>`;
    bootRuntime();

    expect(document.querySelector("p")!.getAttribute("data-ff-faq-question")).toBeNull();
  });

  it("traite un texte très long sans partir en backtracking", () => {
    // Garde anti-régression : la première implémentation du nettoyage de
    // décoration utilisait un regex à alternatives recouvrantes et FIGEAIT
    // l'onglet sur ce genre d'entrée. Doit rester quasi instantané.
    const long = "Lorem ipsum dolor sit amet ".repeat(400);
    document.body.innerHTML = `<div><p>${long}</p><div>${long}</div></div>`;

    const started = Date.now();
    bootRuntime();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("cohérence aperçu / export", () => {
  it("l'export réutilise exactement le runtime de l'aperçu", () => {
    // Les deux implémentations avaient divergé : une FAQ pouvait fonctionner à
    // l'aperçu et rester morte dans le HTML exporté.
    expect(FAQ_RUNTIME_SCRIPT).toBe(ACCORDION_RUNTIME_SCRIPT);
  });
});

describe("CSS d'accompagnement", () => {
  it("révèle les animations au scroll restées invisibles faute de JS", () => {
    // `.et_animated{opacity:0}` (Divi) n'est jamais levé sans le JS du site :
    // les CTA occupaient leur place en restant transparents.
    expect(SCROLL_ANIMATION_REVEAL_CSS).toContain(".et_animated");
    expect(SCROLL_ANIMATION_REVEAL_CSS).toContain("opacity: 1 !important");
  });

  it("ne révèle rien par sélecteur générique", () => {
    // Un `[class*="hide"]{opacity:1}` réveillerait les boîtes masquées
    // volontairement — ex. l'alerte « content is protected » (`.hideme`).
    for (const css of [SCROLL_ANIMATION_REVEAL_CSS, ACCORDION_EDIT_REVEAL_CSS]) {
      expect(css).not.toMatch(/\[class\*=/);
      expect(css).not.toContain("hideme");
    }
  });

  it("déplie les réponses des constructeurs en mode édition", () => {
    expect(ACCORDION_EDIT_REVEAL_CSS).toContain(".et_pb_toggle_content");
    expect(ACCORDION_EDIT_REVEAL_CSS).toContain(".elementor-tab-content");
  });
});
