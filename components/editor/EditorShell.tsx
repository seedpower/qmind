"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFocusedNode, useMindMapStore } from "@/store/useMindMapStore";
import type { MindMapDocument, PersistedEdge, PersistedNode } from "@/lib/types";
import EditorToolbar from "./EditorToolbar";
import HelpOverlay from "./HelpOverlay";

const MindMapCanvas = dynamic(() => import("./MindMapCanvas"), {
  ssr: false,
  loading: () => <div className="canvas-loading">Unfolding canvas…</div>,
});

function serializeNodes(nodes: ReturnType<typeof useMindMapStore.getState>["nodes"]): PersistedNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "mindmap",
    position: node.position,
    data: {
      label: node.data.label,
      color: node.data.color,
      progress: node.data.progress,
      isRoot: node.data.isRoot,
    },
  }));
}

function serializeEdges(edges: ReturnType<typeof useMindMapStore.getState>["edges"]): PersistedEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "mindmap",
  }));
}

export default function EditorShell({ map }: { map: MindMapDocument }) {
  const hydrate = useMindMapStore((s) => s.hydrate);
  const [helpOpen, setHelpOpen] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    hydrate(map);
  }, [hydrate, map]);

  const persist = useCallback(async () => {
    const state = useMindMapStore.getState();
    if (!state.hydrated || savingRef.current) return;
    if (state.nodes.some((node) => node.dragging)) return;
    savingRef.current = true;
    state.setSaveStatus("saving");
    try {
      const res = await fetch(`/api/maps/${state.mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          nodes: serializeNodes(state.nodes),
          edges: serializeEdges(state.edges),
          viewport: state.viewport,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const current = useMindMapStore.getState();
      if (current.saveStatus === "saving") {
        current.setSaveStatus("saved");
      }
    } catch {
      useMindMapStore.getState().setSaveStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const { saveStatus, hydrated } = useMindMapStore.getState();
      if (hydrated && saveStatus === "dirty") {
        void persist();
      }
    }, 900);
    return () => clearInterval(interval);
  }, [persist]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          void persist();
          return;
        }
        if (typing || helpOpen) return;
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            useMindMapStore.getState().redo();
          } else {
            useMindMapStore.getState().undo();
          }
          return;
        }
        if (key === "y") {
          event.preventDefault();
          useMindMapStore.getState().redo();
          return;
        }
        if (key === "c") {
          event.preventDefault();
          useMindMapStore.getState().copySelection();
          return;
        }
        if (key === "x") {
          event.preventDefault();
          useMindMapStore.getState().cutSelection();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          useMindMapStore.getState().pasteOntoSelection();
          return;
        }
        return;
      }

      if (event.key === "?" && !typing) {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      if (helpOpen && event.key === "Escape") {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }

      if (typing || helpOpen) return;
      if (event.altKey) return;

      const state = useMindMapStore.getState();
      const selected = getFocusedNode(state);
      if (!selected) return;

      if (event.key === "Tab") {
        event.preventDefault();
        state.addChildNode(selected.id);
      } else if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        state.selectAdjacent(event.key);
      } else if (event.key === "Enter") {
        event.preventDefault();
        state.addSiblingNode(selected.id);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        state.deleteSelection();
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        void state.autoLayout(event.shiftKey ? "RADIAL" : "RIGHT");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, persist]);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (useMindMapStore.getState().saveStatus === "dirty") {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  return (
    <div className="editor-shell">
      <EditorToolbar onHelp={() => setHelpOpen(true)} />
      <div className="editor-canvas">
        <MindMapCanvas />
      </div>
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
