export function plainDescription(markdown: string, max = 160): string {
  const text = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`/g, "")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= max) return text;

  const space = text.lastIndexOf(" ", max - 1);
  const end = space === -1 ? max - 1 : space;
  return text.slice(0, end).replace(/[,;:.–—\- ]+$/, "") + "…";
}
