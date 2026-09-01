"use client";

import dynamic from "next/dynamic";
import { useShallow } from "zustand/react/shallow";
import { getSelectedEditNode, useMindMapStore } from "@/store/useMindMapStore";
import "@uiw/react-md-editor/markdown-editor.css";
import "@/app/node-markdown-editor.css";

const NodeMdEditor = dynamic(() => import("./NodeMdEditor"), {
  ssr: false,
  loading: () => <div className="node-md-loading">Loading editor…</div>,
});

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
