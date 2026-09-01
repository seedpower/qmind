import { Square, SquareCheck } from "lucide-react";
import type { ICommand, TextAreaTextApi, TextState } from "@uiw/react-md-editor";

type TaskKind = "todo" | "done";

const LIST_LINE =
  /^(\s*)([-*+]|\d+\.)\s+(?:\[([ xX])\]\s*)?(.*)$/;

function selectedLines(text: string, start: number, end: number) {
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

function applyTaskKind(line: string, kind: TaskKind) {
  const box = kind === "done" ? "[x]" : "[ ]";
  const match = line.match(LIST_LINE);
  if (match) {
    const indent = match[1] ?? "";
    const marker = match[2] ?? "-";
    const rest = match[4] ?? "";
    return `${indent}${marker} ${box} ${rest}`;
  }
  if (!line.trim()) return `- ${box} `;
  const indent = /^\s*/.exec(line)?.[0] ?? "";
  return `${indent}- ${box} ${line.trimStart()}`;
}

function executeTask(state: TextState, api: TextAreaTextApi, kind: TaskKind) {
  const { from, to } = selectedLines(state.text, state.selection.start, state.selection.end);
  const next = state.text
    .slice(from, to)
    .split("\n")
    .map((line) => applyTaskKind(line, kind))
    .join("\n");
  api.setSelectionRange({ start: from, end: to });
  api.replaceSelection(next);
  api.setSelectionRange({ start: from, end: from + next.length });
}

const iconProps = { width: 13, height: 13, strokeWidth: 2 } as const;

export const taskTodoCommand: ICommand = {
  name: "task-todo",
  keyCommand: "task-todo",
  prefix: "- [ ] ",
  buttonProps: {
    "aria-label": "Add task",
    title: "Add task",
  },
  icon: <Square {...iconProps} />,
  execute: (state, api) => executeTask(state, api, "todo"),
};

export const taskDoneCommand: ICommand = {
  name: "task-done",
  keyCommand: "task-done",
  prefix: "- [x] ",
  buttonProps: {
    "aria-label": "Mark task done",
    title: "Mark task done",
  },
  icon: <SquareCheck {...iconProps} />,
  execute: (state, api) => executeTask(state, api, "done"),
};

export function withTaskCommands(commands: ICommand[]) {
  return commands.flatMap((command) => {
    if (command.name === "checked-list") {
      return [taskTodoCommand, taskDoneCommand];
    }
    return [command];
  });
}

const TASK_LINE = /^((?:\s*>\s*)*\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](.*)$/;
const FENCE_LINE = /^\s*(`{3,}|~{3,})/;

/** Toggle the Nth GFM task item in markdown; returns the original string if none match. */
export function toggleTaskAtIndex(markdown: string, index: number) {
  if (index < 0) return markdown;
  let seen = 0;
  let inFence = false;
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (FENCE_LINE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(TASK_LINE);
    if (!match) continue;
    if (seen !== index) {
      seen += 1;
      continue;
    }
    const prefix = match[1] ?? "";
    const rest = match[3] ?? "";
    const nextMark = match[2] === " " ? "x" : " ";
    lines[i] = `${prefix}[${nextMark}]${rest}`;
    return lines.join("\n");
  }
  return markdown;
}
