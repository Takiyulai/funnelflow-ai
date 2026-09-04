/** Explicit previews must not be confused with random allocation or visits. */
export function isAbPreview(search: string): boolean {
  const variant = new URLSearchParams(search).get("ff_ab");
  return variant === "a" || variant === "b";
}
