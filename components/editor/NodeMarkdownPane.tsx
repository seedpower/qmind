"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getSelectedEditNode, useMindMapStore } from "@/store/useMindMapStore";
import "@uiw/react-md-editor/markdown-editor.css";
import "@/app/node-markdown-editor.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <div className="node-md-loading">Loading editor…</div>,
  },
);

function NodeMdEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(320);

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
        preview="live"
        textareaProps={{
          placeholder: "Write markdown for this node…",
        }}
      />
    </div>
  );
}

export default function NodeMarkdownPane() {
  const selected = useMindMapStore(
    useShallow((state) => {
      const node = getSelectedEditNode(state);
      if (!node) {
        return { id: null as string | null, label: "", markdown: "" };
      }
      return {
        id: node.id,
        label: node.data.label,
        markdown: node.data.markdown ?? "",
      };
    }),
  );
  const updateNodeMarkdown = useMindMapStore((state) => state.updateNodeMarkdown);
  const selectedId = selected.id;

  return (
    <aside className="editor-notes" aria-label="Node notes">
      {selectedId ? (
        <>
          <header className="node-md-header">
            <p className="node-md-kicker">Node notes</p>
            <h2 title={selected.label}>{selected.label}</h2>
          </header>
          <NodeMdEditor
            key={selectedId}
            value={selected.markdown}
            onChange={(markdown) => updateNodeMarkdown(selectedId, markdown)}
          />
        </>
      ) : (
        <div className="node-md-empty">
          <p>Select a node to write notes</p>
        </div>
      )}
    </aside>
  );
}
