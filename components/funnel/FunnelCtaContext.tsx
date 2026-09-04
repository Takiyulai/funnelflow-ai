"use client";

import { createContext } from "react";
import type { Funnel, FunnelPage } from "@/lib/funnels/types";

// Patterns use the same page navigation and popup runtime as standard sections.
export const FunnelCtaContext = createContext<{
  funnel: Funnel;
  page?: FunnelPage;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
} | null>(null);
