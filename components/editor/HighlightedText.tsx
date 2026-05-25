// components/editor/HighlightedText.tsx
"use client";

import React from "react";

export function HighlightedText({ value }: { value: string }) {
  if (!value) return null;
  const parts: React.ReactNode[] = [];
  const regex = /\[\[([^\]|]+?)(?:\|(#[0-9a-fA-F]{3,8}))?\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }
    const [, text, hex] = match;
    parts.push(
      <span
        key={key++}
        className="ff-hl"
        style={hex ? { color: hex } : undefined}
        data-ff-hl="1"
      >
        {text}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return <>{parts}</>;
}
