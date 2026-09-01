const INDENT = "\t";

function selectedBlock(text: string, start: number, end: number) {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  let to = end;
  if (end > start && text[end - 1] === "\n") {
    to = end - 1;
  } else {
    const newline = text.indexOf("\n", end);
    to = newline === -1 ? text.length : newline;
  }
  return { from, to };
}

function unindentLine(line: string) {
  if (line.startsWith("\t")) return { line: line.slice(1), removed: 1 };
  if (line.startsWith("  ")) return { line: line.slice(2), removed: 2 };
  if (line.startsWith(" ")) return { line: line.slice(1), removed: 1 };
  return { line, removed: 0 };
}

export function indentMarkdown(
  text: string,
  start: number,
  end: number,
  unindent: boolean,
) {
  const { from, to } = selectedBlock(text, start, end);
  const lines = text.slice(from, to).split("\n");
  let startDelta = 0;
  let endDelta = 0;

  const nextLines = lines.map((line, index) => {
    if (unindent) {
      const result = unindentLine(line);
      if (index === 0) {
        const offsetInLine = start - from;
        startDelta = -Math.min(result.removed, offsetInLine);
      }
      endDelta -= result.removed;
      return result.line;
    }
    if (index === 0) startDelta = INDENT.length;
    endDelta += INDENT.length;
    return INDENT + line;
  });

  const block = nextLines.join("\n");
  return {
    text: text.slice(0, from) + block + text.slice(to),
    start: Math.max(from, start + startDelta),
    end: Math.max(from, end + endDelta),
  };
}

const TASK_LINE =
  /^((?:\s*>\s*)*\s*)([-*+]|\d+\.)\s+\[([ xX])\](?:\s+(.*))?$/;

function currentLineRange(text: string, cursor: number) {
  const from = text.lastIndexOf("\n", cursor - 1) + 1;
  const newline = text.indexOf("\n", cursor);
  const to = newline === -1 ? text.length : newline;
  return { from, to };
}

/** Continue a GFM task on Enter with a same-level empty checkbox. */
export function continueMarkdownTask(text: string, start: number, end: number) {
  const { from } = currentLineRange(text, start);
  const lineTo = text.indexOf("\n", start);
  const to = lineTo === -1 ? text.length : lineTo;
  const line = text.slice(from, to);
  const match = line.match(TASK_LINE);
  if (!match) return null;

  const indent = match[1] ?? "";
  const marker = match[2] ?? "-";
  const ordered = /^(\d+)\.$/.exec(marker);
  const nextMarker = ordered ? `${Number(ordered[1]) + 1}.` : marker;
  const inserted = `\n${indent}${nextMarker} [ ] `;
  const next = text.slice(0, start) + inserted + text.slice(end);
  const caret = start + inserted.length;
  return { text: next, start: caret, end: caret };
}
