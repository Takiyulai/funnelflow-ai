import { describe, expect, it } from "vitest";
import { compileEmailDocument, sanitizeEmailRichHtml } from "@/lib/email-editor/compiler";
import { customFieldsToPersonalization } from "@/lib/email-editor/personalization";
import { personalize } from "@/lib/crm/emailRender";
import {
  createEmailBlock,
  createEmptyEmailDocument,
  legacyHtmlToDocument,
  markEmailDocumentEdited,
} from "@/lib/email-editor/document";

describe("email document compiler", () => {
  it("compile les blocs avec styles email inline et préheader", () => {
    const document = createEmptyEmailDocument();
    const heading = createEmailBlock("heading");
    const button = createEmailBlock("button");
    if (heading.type !== "heading" || button.type !== "button") throw new Error("unexpected block");
    heading.content.text = "Votre titre";
    button.content = { text: "Passer à l’action", url: "https://example.com" };
    document.blocks = [heading, button];

    const html = compileEmailDocument(document, { preheader: "Aperçu boîte mail" });

    expect(html).toContain("ff-email-card");
    expect(html).toContain("Aperçu boîte mail");
    expect(html).toContain("Passer à l’action");
    expect(html).toContain("style=");
  });

  it("neutralise le HTML actif sans retirer le contenu éditorial", () => {
    const html = sanitizeEmailRichHtml(
      '<p onclick="alert(1)">Bonjour</p><script>alert(2)</script><a href="javascript:alert(3)">Lien</a>',
    );

    expect(html).toContain("Bonjour");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("préserve strictement un email legacy tant qu'il n'est pas modifié", () => {
    const legacy = "<!doctype html><html><body><p>Historique</p></body></html>";
    const document = legacyHtmlToDocument(legacy);

    expect(compileEmailDocument(document)).toBe(legacy);

    const edited = markEmailDocumentEdited(document);
    expect(compileEmailDocument(edited)).toContain("ff-email-card");
    expect(compileEmailDocument(edited)).toContain("Historique");
  });

  it("conserve les identifiants de blocs lors d'une compilation", () => {
    const document = createEmptyEmailDocument();
    const block = createEmailBlock("richText");
    document.blocks = [block];

    compileEmailDocument(document);

    expect(document.blocks[0].id).toBe(block.id);
  });

  it("ne met pas les blocs non configurés dans l'email final", () => {
    const document = createEmptyEmailDocument();
    document.blocks = [
      createEmailBlock("heading"),
      createEmailBlock("richText"),
      createEmailBlock("image"),
      createEmailBlock("button"),
    ];

    const html = compileEmailDocument(document);

    expect(html).not.toContain("Votre titre");
    expect(html).not.toContain("Écrivez votre message");
    expect(html).not.toContain("Image à ajouter");
    expect(html).not.toContain("Passer à l’action");
  });

  it("compile l'alignement justifié", () => {
    const document = createEmptyEmailDocument();
    const block = createEmailBlock("richText");
    if (block.type !== "richText") throw new Error("unexpected block");
    block.content.html = "<p>Un texte suffisamment long.</p>";
    block.style.align = "justify";
    document.blocks = [block];

    expect(compileEmailDocument(document)).toContain("text-align:justify");
  });
});

describe("personnalisation email", () => {
  it("propose les champs CRM personnalisés et les résout à l'envoi", () => {
    const fields = customFieldsToPersonalization([
      { field_key: "secteur_activite", label: "Secteur d’activité" },
    ]);

    expect(fields[0]?.token).toBe("{{secteur_activite}}");
    expect(
      personalize("Bonjour {{prenom}}, secteur : {{secteur_activite}}", {
        email: "alex@example.com",
        firstName: "Alex",
        customFields: { secteur_activite: "Coaching" },
      }),
    ).toBe("Bonjour Alex, secteur : Coaching");
  });
});
