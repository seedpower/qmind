"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { NODE_COLORS } from "@/lib/types";
import { useMindMapStore, type FlowNode } from "@/store/useMindMapStore";

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
  const palette = NODE_COLORS[data.color];

  useEffect(() => {
    if (!data.editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [data.editing]);

  return (
    <div
      className={`mindmap-node ${data.isRoot ? "is-root" : ""} ${selected ? "is-selected" : ""}`}
      style={
        {
          "--node-bg": palette.bg,
          "--node-border": palette.border,
          "--node-text": palette.text,
        } as React.CSSProperties
      }
      onPointerDown={(event) => {
        if (event.button !== 0 || event.shiftKey) return;
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("button, input, .react-flow__handle")
        ) {
          return;
        }
        useMindMapStore.setState((state) => {
          const current = state.nodes.find((node) => node.id === id);
          if (!current || current.selected) return state;
          return {
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
      <div className="mindmap-text">
        <span className="mindmap-sizer" aria-hidden>
          {data.label || (data.editing ? " " : "新节点")}
        </span>
        {data.editing ? (
          <input
            ref={inputRef}
            className="mindmap-input nodrag nopan"
            value={data.label}
            size={1}
            maxLength={200}
            onChange={(event) => updateNodeLabel(id, event.target.value)}
            onBlur={() => {
              window.setTimeout(() => {
                if (document.activeElement !== inputRef.current) {
                  finishEditing(id);
                }
              }, 0);
            }}
            onKeyDown={(event) => {
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
          <span className="mindmap-label">{data.label || "新节点"}</span>
        )}
      </div>
      <button
        type="button"
        className="mindmap-add nodrag nopan"
        title="添加子节点 (Tab)"
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
