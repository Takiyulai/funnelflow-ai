import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";

describe("FunnelPreview", () => {
  it("renders generated funnel sections", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    expect(screen.getByText(demoFunnel.sections[0].headline)).toBeInTheDocument();
    expect(screen.getByText(/Questions fréquentes/i)).toBeInTheDocument();
  });
});
