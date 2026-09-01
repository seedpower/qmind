"use client";

import MDEditor, { commands } from "@uiw/react-md-editor";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { withTaskCommands } from "./nodeMdTaskCommands";

export default function NodeMdEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(320);
  const toolbarCommands = useMemo(() => withTaskCommands(commands.getCommands()), []);

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
        preview="edit"
        commands={toolbarCommands}
        textareaProps={{
          placeholder: "Write markdown for this node…",
        }}
      />
    </div>
  );
}
