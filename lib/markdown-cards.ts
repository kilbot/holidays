export interface MarkdownChunk {
  card: boolean;
  markdown: string;
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
