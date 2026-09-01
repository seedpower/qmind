"use client";

import MDEditor, { commands } from "@uiw/react-md-editor";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { toggleTaskAtIndex, withTaskCommands } from "./nodeMdTaskCommands";
import { indentMarkdown, continueMarkdownTask } from "./nodeMdIndent";

function isPreviewChecked(checked: unknown) {
  return checked === true || checked === "" || checked === "checked";
}

function PreviewCheckbox({
  node: _node,
  checked,
  disabled: _disabled,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { node?: unknown }) {
  if (props.type !== "checkbox") {
    return <input {...props} checked={checked} />;
  }
  const isChecked = isPreviewChecked(checked);
  return (
    <input
      {...props}
      key={isChecked ? "on" : "off"}
      type="checkbox"
      disabled={false}
      checked={isChecked}
      onChange={() => undefined}
    />
  );
}

export default function NodeMdEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const [height, setHeight] = useState(320);
  const toolbarCommands = useMemo(() => withTaskCommands(commands.getCommands()), []);
  const editorComponents = useMemo(
    () => ({
      preview: (source: string) => (
        <MDEditor.Markdown
          source={source}
          warpperElement={{ "data-color-mode": "dark" }}
          components={{ input: PreviewCheckbox }}
        />
      ),
    }),
    [],
  );

  valueRef.current = value;
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    const root = wrapRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const sync = () => {
      const next = Math.max(200, Math.floor(root.clientHeight));
      setHeight((prev) => (prev === next ? prev : next));
    };

    const observer = new ResizeObserver(sync);
    observer.observe(root);
    sync();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = wrapRef.current;
    if (!root) return;

    const syncFullscreen = () => {
      document.documentElement.classList.toggle(
        "node-md-fs",
        Boolean(root.querySelector(".w-md-editor-fullscreen")),
      );
    };

    const observer = new MutationObserver(syncFullscreen);
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    syncFullscreen();
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("node-md-fs");
    };
  }, []);

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    pendingSelection.current = null;
    const textarea = wrapRef.current?.querySelector(
      "textarea.w-md-editor-text-input",
    );
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.setSelectionRange(pending.start, pending.end);
    }
  }, [value]);

  useLayoutEffect(() => {
    const root = wrapRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const preview = root.querySelector(".w-md-editor-preview");
      if (!(event.target instanceof Element) || !preview?.contains(event.target)) {
        return;
      }
      if (event.target.closest("a, button, textarea, input:not([type='checkbox'])")) {
        return;
      }
      const item = event.target.closest("li.task-list-item");
      if (!item || !preview.contains(item)) return;
      event.preventDefault();
      event.stopPropagation();
      const index = Array.prototype.indexOf.call(
        preview.querySelectorAll("li.task-list-item"),
        item,
      );
      const next = toggleTaskAtIndex(valueRef.current, index);
      if (next === valueRef.current) return;
      const box = item.querySelector("input[type='checkbox']");
      if (box instanceof HTMLInputElement) {
        box.checked = !box.checked;
      }
      onChangeRef.current(next);
    };

    const applyEdit = (
      textarea: HTMLTextAreaElement,
      next: { text: string; start: number; end: number },
    ) => {
      if (next.text === textarea.value) {
        pendingSelection.current = { start: next.start, end: next.end };
        textarea.setSelectionRange(next.start, next.end);
        return;
      }
      pendingSelection.current = { start: next.start, end: next.end };
      onChangeRef.current(next.text);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      if (!event.target.classList.contains("w-md-editor-text-input")) return;
      if (event.isComposing) return;

      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        applyEdit(
          event.target,
          indentMarkdown(
            event.target.value,
            event.target.selectionStart,
            event.target.selectionEnd,
            event.shiftKey,
          ),
        );
        return;
      }

      if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }
      const continued = continueMarkdownTask(
        event.target.value,
        event.target.selectionStart,
        event.target.selectionEnd,
      );
      if (!continued) return;
      event.preventDefault();
      event.stopPropagation();
      applyEdit(event.target, continued);
    };

    root.addEventListener("click", onClick, true);
    root.addEventListener("keydown", onKeyDown, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="node-md-compose node-md-compose-fill"
      data-color-mode="dark"
    >
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? "")}
        height={height}
        visibleDragbar={false}
        preview="live"
        commands={toolbarCommands}
        components={editorComponents}
        textareaProps={{
          placeholder: "Write markdown for this node…",
        }}
        tabSize={2}
        defaultTabEnable={false}
      />
    </div>
  );
}
