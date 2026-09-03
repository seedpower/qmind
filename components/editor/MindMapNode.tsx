"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import { DEFAULT_NODE_LABEL, getNodePalette } from "@/lib/types";
import { useMindMapStore, type FlowNode } from "@/store/useMindMapStore";
import { ProgressRing } from "./ProgressRing";

export default function MindMapNode({
  id,
  data,
  selected,
}: NodeProps<FlowNode>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeLabel = useMindMapStore((s) => s.updateNodeLabel);
  const startEditing = useMindMapStore((s) => s.startEditing);
  const finishEditing = useMindMapStore((s) => s.finishEditing);
  const addChildNode = useMindMapStore((s) => s.addChildNode);
  const focused = useMindMapStore((s) => s.lastSelectedId === id);
  const { bg, border, text } = getNodePalette(data.color);
  const liveInput = Boolean(data.editing || (selected && focused));

  useLayoutEffect(() => {
    if (!liveInput || !data.editing) return;
    const input = inputRef.current;
    if (!input) return;
    const active = document.activeElement;
    if (
      active &&
      active !== document.body &&
      active !== input &&
      !(
        active instanceof HTMLElement &&
        active.closest(".react-flow, .canvas-host, .editor-canvas")
      )
    ) {
      return;
    }
    input.focus({ preventScroll: true });
    if (data.editing && data.editSelectAll !== false) {
      input.select();
    }
  }, [liveInput, data.editing, data.editSelectAll]);

  return (
    <div
      className={`mindmap-node ${data.isRoot ? "is-root" : ""} ${selected ? "is-selected" : ""} ${selected && focused ? "is-focused" : ""}`}
      style={
        {
          "--node-bg": bg,
          "--node-border": border,
          "--node-text": text,
        } as React.CSSProperties
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("button, input, .react-flow__handle")
        ) {
          return;
        }
        useMindMapStore.setState((state) => {
          const current = state.nodes.find((node) => node.id === id);
          if (event.shiftKey) {
            return { lastSelectedId: id };
          }
          if (!current || current.selected) {
            return current?.selected ? { lastSelectedId: id } : state;
          }
          return {
            lastSelectedId: id,
            nodes: state.nodes.map((node) => ({
              ...node,
              selected: node.id === id,
            })),
          };
        });
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEditing(id);
      }}
    >
      <Handle type="target" position={Position.Left} className="mindmap-handle target" />
      {data.progress != null ? (
        <ProgressRing progress={data.progress} size={data.isRoot ? 18 : 16} />
      ) : null}
      <div className="mindmap-text">
        <span className="mindmap-sizer" aria-hidden>
          {data.label || (liveInput ? " " : DEFAULT_NODE_LABEL)}
        </span>
        {liveInput ? (
          <input
            ref={inputRef}
            className={`mindmap-input nodrag nopan ${data.editing ? "is-editing" : ""}`}
            value={data.label}
            size={1}
            maxLength={200}
            onChange={(event) => {
              if (!data.editing) startEditing(id, { selectAll: false });
              updateNodeLabel(id, event.target.value);
            }}
            onCompositionStart={() => {
              if (!data.editing) startEditing(id, { selectAll: false });
            }}
            onBlur={() => {
              window.setTimeout(() => {
                if (document.activeElement === inputRef.current) return;
                const current = useMindMapStore
                  .getState()
                  .nodes.find((node) => node.id === id);
                if (!current?.data.editing) return;
                finishEditing(id);
              }, 0);
            }}
            onKeyDown={(event) => {
              if (!data.editing) return;
              event.stopPropagation();
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.currentTarget.blur();
              }
            }}
            spellCheck={false}
          />
        ) : (
          <span className="mindmap-label">{data.label || DEFAULT_NODE_LABEL}</span>
        )}
      </div>
      <button
        type="button"
        className="mindmap-add nodrag nopan"
        title="Add child (Tab)"
        onClick={(event) => {
          event.stopPropagation();
          addChildNode(id);
        }}
      >
        +
      </button>
      <Handle type="source" position={Position.Right} className="mindmap-handle source" />
    </div>
  );
}
