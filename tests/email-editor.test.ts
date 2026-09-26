import { describe, expect, it } from "vitest";
import { compileEmailDocument, sanitizeEmailRichHtml } from "@/lib/email-editor/compiler";
import {
  createEmailBlock,
  createEmptyEmailDocument,
  legacyHtmlToDocument,
  markEmailDocumentEdited,
} from "@/lib/email-editor/document";

describe("email document compiler", () => {
  it("compile les blocs avec styles email inline et préheader", () => {
    const document = createEmptyEmailDocument();
    document.blocks = [createEmailBlock("heading"), createEmailBlock("button")];

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
});
