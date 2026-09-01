"use client";

import { ClipboardPaste, Copy, GitBranch, Plus, Scissors, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { COLOR_ORDER, NODE_COLORS, type NodeColor } from "@/lib/types";
import { useMindMapStore } from "@/store/useMindMapStore";
import { ProgressPicker } from "./ProgressRing";

const COLOR_LABELS: Record<NodeColor, string> = {
  amber: "Amber",
  rose: "Rose",
  teal: "Teal",
  violet: "Violet",
  sky: "Sky",
  lime: "Lime",
  stone: "Stone",
};

type Props = {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
};

export default function NodeContextMenu({ nodeId, x, y, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const node = useMindMapStore((s) => s.nodes.find((item) => item.id === nodeId));
  const addChildNode = useMindMapStore((s) => s.addChildNode);
  const addSiblingNode = useMindMapStore((s) => s.addSiblingNode);
  const copySelection = useMindMapStore((s) => s.copySelection);
  const cutSelection = useMindMapStore((s) => s.cutSelection);
  const pasteOntoSelection = useMindMapStore((s) => s.pasteOntoSelection);
  const clipboard = useMindMapStore((s) => s.clipboard);
  const canCut = useMindMapStore((s) =>
    s.nodes.some((item) => item.selected && !item.data.isRoot),
  );
  const deleteSelection = useMindMapStore((s) => s.deleteSelection);
  const updateNodeColor = useMindMapStore((s) => s.updateNodeColor);
  const updateNodeProgress = useMindMapStore((s) => s.updateNodeProgress);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    el.style.left = `${Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad))}px`;
    el.style.top = `${Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad))}px`;
  }, [x, y, nodeId]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!node) return null;

  const isRoot = Boolean(node.data.isRoot);

  return createPortal(
    <div
      ref={menuRef}
      className="node-menu"
      role="menu"
      aria-label="Node actions"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="node-menu-item"
        onClick={() => {
          addChildNode(nodeId);
          onClose();
        }}
      >
        <Plus size={14} />
        Add child
        <kbd>Tab</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="node-menu-item"
        disabled={isRoot}
        title={isRoot ? "The central topic has no siblings" : undefined}
        onClick={() => {
          addSiblingNode(nodeId);
          onClose();
        }}
      >
        <GitBranch size={14} />
        Add sibling
        <kbd>Enter</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="node-menu-item"
        disabled={!canCut}
        title={canCut ? undefined : "The central topic cannot be cut"}
        onClick={() => {
          cutSelection();
          onClose();
        }}
      >
        <Scissors size={14} />
        Cut
        <kbd>⌘X</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="node-menu-item"
        onClick={() => {
          copySelection();
          onClose();
        }}
      >
        <Copy size={14} />
        Copy
        <kbd>⌘C</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="node-menu-item"
        disabled={!clipboard}
        title={clipboard ? undefined : "Copy or cut nodes first"}
        onClick={() => {
          pasteOntoSelection(nodeId);
          onClose();
        }}
      >
        <ClipboardPaste size={14} />
        Paste here
        <kbd>⌘V</kbd>
      </button>
      <div className="node-menu-sep" />
      <div className="node-menu-label">Color</div>
      <div className="node-menu-colors" role="group" aria-label="Node color">
        {COLOR_ORDER.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-dot ${node.data.color === color ? "active" : ""}`}
            style={{ background: NODE_COLORS[color].border }}
            title={COLOR_LABELS[color]}
            aria-label={COLOR_LABELS[color]}
            onClick={() => {
              updateNodeColor(nodeId, color);
              onClose();
            }}
          />
        ))}
      </div>
      <div className="node-menu-sep" />
      <div className="node-menu-label">Progress</div>
      <div className="node-menu-progress">
        <ProgressPicker
          value={node.data.progress}
          onChange={(progress) => updateNodeProgress(nodeId, progress)}
        />
      </div>
      <div className="node-menu-sep" />
      <button
        type="button"
        role="menuitem"
        className="node-menu-item danger"
        disabled={isRoot}
        title={isRoot ? "The central topic cannot be deleted" : undefined}
        onClick={() => {
          deleteSelection(nodeId);
          onClose();
        }}
      >
        <Trash2 size={14} />
        Delete node
        <kbd>Del</kbd>
      </button>
    </div>,
    document.body,
  );
}
