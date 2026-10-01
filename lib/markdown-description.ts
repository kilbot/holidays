/** The first prose line of a Markdown document, trimmed; undefined if none. */
export function firstParagraph(markdown: string): string | undefined {
  return markdown.split("\n").map((line) => line.trim()).find((line) =>
    line !== "" &&
    !/^[#>|]/.test(line) &&
    !/^(?:[-*+] |\d+[.)] )/.test(line) &&
    !/^(?:-{3,}|\*{3,}|_{3,})$/.test(line),
  );
}

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
