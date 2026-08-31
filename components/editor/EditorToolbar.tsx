"use client";

import Link from "next/link";
import {
  ArrowDown,
  Check,
  GitBranch,
  HelpCircle,
  LayoutTemplate,
  LoaderCircle,
  Orbit,
  Plus,
  Trash2,
} from "lucide-react";
import { COLOR_ORDER, NODE_COLORS } from "@/lib/types";
import { useMindMapStore } from "@/store/useMindMapStore";

type Props = {
  onHelp: () => void;
};

export default function EditorToolbar({ onHelp }: Props) {
  const title = useMindMapStore((s) => s.title);
  const setTitle = useMindMapStore((s) => s.setTitle);
  const saveStatus = useMindMapStore((s) => s.saveStatus);
  const nodes = useMindMapStore((s) => s.nodes);
  const addChildNode = useMindMapStore((s) => s.addChildNode);
  const deleteSelection = useMindMapStore((s) => s.deleteSelection);
  const autoLayout = useMindMapStore((s) => s.autoLayout);
  const layouting = useMindMapStore((s) => s.layouting);
  const updateNodeColor = useMindMapStore((s) => s.updateNodeColor);

  const selected = nodes.find((node) => node.selected) ?? nodes.find((n) => n.data.isRoot);
  const canDelete = Boolean(selected && !selected.data.isRoot);

  return (
    <header className="editor-toolbar">
      <div className="toolbar-left">
        <Link href="/" className="back-link">
          QMind
        </Link>
        <span className="toolbar-rule" />
        <input
          className="title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          aria-label="脑图标题"
        />
      </div>

      <div className="toolbar-center">
        <button
          type="button"
          className="tool-btn"
          disabled={!selected}
          onClick={() => selected && addChildNode(selected.id)}
        >
          <Plus size={15} />
          子节点
        </button>
        <button
          type="button"
          className="tool-btn danger"
          disabled={!canDelete}
          onClick={deleteSelection}
        >
          <Trash2 size={15} />
          删除
        </button>
        <div className="layout-group">
          <button
            type="button"
            className="tool-btn"
            disabled={layouting}
            onClick={() => void autoLayout("RIGHT")}
          >
            {layouting ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <LayoutTemplate size={15} />
            )}
            {layouting ? "排版中" : "整理"}
          </button>
          <button
            type="button"
            className="tool-btn compact"
            disabled={layouting}
            title="向下排版"
            onClick={() => void autoLayout("DOWN")}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="tool-btn compact"
            disabled={layouting}
            title="辐射排版"
            onClick={() => void autoLayout("RADIAL")}
          >
            <Orbit size={15} />
          </button>
        </div>
        <div className="color-row" role="group" aria-label="节点颜色">
          {COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-dot ${selected?.data.color === color ? "active" : ""}`}
              style={{ background: NODE_COLORS[color].border }}
              title={color}
              disabled={!selected}
              onClick={() => selected && updateNodeColor(selected.id, color)}
            />
          ))}
        </div>
      </div>

      <div className="toolbar-right">
        <SaveBadge status={saveStatus} count={nodes.length} />
        <button type="button" className="icon-btn" onClick={onHelp} title="快捷键">
          <HelpCircle size={16} />
        </button>
        <span className="branch-mark">
          <GitBranch size={14} />
        </span>
      </div>
    </header>
  );
}

function SaveBadge({
  status,
  count,
}: {
  status: string;
  count: number;
}) {
  const label =
    status === "saving"
      ? "保存中"
      : status === "dirty"
        ? "未保存"
        : status === "error"
          ? "保存失败"
          : "已保存";

  return (
    <span className={`save-badge is-${status}`}>
      {status === "saving" ? (
        <LoaderCircle size={13} className="spin" />
      ) : (
        <Check size={13} />
      )}
      {label}
      <span className="count">{count} 节点</span>
    </span>
  );
}
