export interface MarkdownChunk {
  card: boolean;
  markdown: string;
}

/** "Western Australia" → "western-australia". Lowercase; runs of anything not a-z or 0-9 become one "-"; no leading or trailing "-". */
export function headingSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface MarkdownSection { id: string; title: string; cards: number }

/** Each `## ` heading in order, with the number of `### ` headings under it before the next `#` or `## `. id = headingSlug(title). */
export function sectionIndex(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let section: MarkdownSection | undefined;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      section = { id: headingSlug(title), title, cards: 0 };
      sections.push(section);
    } else if (line.startsWith("# ")) {
      section = undefined;
    } else if (line.startsWith("### ") && section) {
      section.cards++;
    }
  }

  return sections;
}

export function splitCards(markdown: string, level: 2 | 3): MarkdownChunk[] {
  const chunks: { card: boolean; lines: string[] }[] = [];
  let current: { card: boolean; lines: string[] } = { card: false, lines: [] };

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^(#+) /);
    if (heading && heading[1].length <= level) {
      if (current.lines.join("\n").trim()) chunks.push(current);
      current = { card: heading[1].length === level, lines: [] };
    }
    current.lines.push(line);
  }

  if (current.lines.join("\n").trim()) chunks.push(current);
  return chunks.map(({ card, lines }) => ({ card, markdown: lines.join("\n") }));
}
