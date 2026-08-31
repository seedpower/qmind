"use client";

import { GitBranch, Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { COLOR_ORDER, NODE_COLORS, type NodeColor } from "@/lib/types";
import { useMindMapStore } from "@/store/useMindMapStore";

const COLOR_LABELS: Record<NodeColor, string> = {
  amber: "琥珀",
  rose: "玫红",
  teal: "青绿",
  violet: "紫",
  sky: "天蓝",
  lime: "叶绿",
  stone: "石灰",
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
  const deleteSelection = useMindMapStore((s) => s.deleteSelection);
  const updateNodeColor = useMindMapStore((s) => s.updateNodeColor);

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
      aria-label="节点操作"
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
        新建子节点
        <kbd>Tab</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="node-menu-item"
        disabled={isRoot}
        title={isRoot ? "中心主题没有同级" : undefined}
        onClick={() => {
          addSiblingNode(nodeId);
          onClose();
        }}
      >
        <GitBranch size={14} />
        新建同级节点
        <kbd>Enter</kbd>
      </button>
      <div className="node-menu-sep" />
      <div className="node-menu-label">颜色</div>
      <div className="node-menu-colors" role="group" aria-label="节点颜色">
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
      <button
        type="button"
        role="menuitem"
        className="node-menu-item danger"
        disabled={isRoot}
        title={isRoot ? "不能删除中心主题" : undefined}
        onClick={() => {
          deleteSelection(nodeId);
          onClose();
        }}
      >
        <Trash2 size={14} />
        删除节点
        <kbd>Del</kbd>
      </button>
    </div>,
    document.body,
  );
}
