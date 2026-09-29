import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailRichEditor } from "@/components/crm/EmailRichEditor";
import { DEFAULT_EMAIL_PERSONALIZATION_FIELDS } from "@/lib/email-editor/personalization";

describe("variables de substitution dans l'éditeur d'email", () => {
  it("insère une variable au curseur même sans execCommand", () => {
    const onChange = vi.fn();
    const { container } = render(
      <EmailRichEditor
        value="<p>Bonjour </p>"
        onChange={onChange}
        personalizationFields={DEFAULT_EMAIL_PERSONALIZATION_FIELDS}
      />,
    );

    const editor = container.querySelector<HTMLDivElement>("[contenteditable='true']");
    const textNode = editor?.querySelector("p")?.firstChild;
    if (!editor || !textNode) throw new Error("éditeur introuvable");

    const range = document.createRange();
    range.setStart(textNode, textNode.textContent?.length ?? 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const picker = screen.getByRole("button", { name: "Variables de substitution" });
    fireEvent.mouseDown(picker);
    fireEvent.click(picker);
    fireEvent.mouseDown(screen.getByRole("button", { name: /Prénom/ }));
    fireEvent.click(screen.getByRole("button", { name: /Prénom/ }));

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("Bonjour {{prenom}}"));
  });
});
