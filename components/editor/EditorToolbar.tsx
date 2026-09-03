"use client";

import Link from "next/link";
import {
  ArrowDown,
  Check,
  ClipboardPaste,
  Copy,
  GitBranch,
  HelpCircle,
  LayoutTemplate,
  LoaderCircle,
  Orbit,
  Plus,
  Redo2,
  Save,
  Scissors,
  Trash2,
  Undo2,
} from "lucide-react";
import QMindMark from "@/components/brand/QMindMark";
import { COLOR_ORDER, getColorSwatch } from "@/lib/types";
import { getFocusedNode, useMindMapStore } from "@/store/useMindMapStore";
import { ProgressPicker } from "./ProgressRing";

type Props = {
  onHelp: () => void;
  onSave: () => void;
};

export default function EditorToolbar({ onHelp, onSave }: Props) {
  const title = useMindMapStore((s) => s.title);
  const setTitle = useMindMapStore((s) => s.setTitle);
  const saveStatus = useMindMapStore((s) => s.saveStatus);
  const nodes = useMindMapStore((s) => s.nodes);
  const addChildNode = useMindMapStore((s) => s.addChildNode);
  const copySelection = useMindMapStore((s) => s.copySelection);
  const cutSelection = useMindMapStore((s) => s.cutSelection);
  const pasteOntoSelection = useMindMapStore((s) => s.pasteOntoSelection);
  const clipboard = useMindMapStore((s) => s.clipboard);
  const deleteSelection = useMindMapStore((s) => s.deleteSelection);
  const canUndo = useMindMapStore((s) => s.canUndo);
  const canRedo = useMindMapStore((s) => s.canRedo);
  const undo = useMindMapStore((s) => s.undo);
  const redo = useMindMapStore((s) => s.redo);
  const autoLayout = useMindMapStore((s) => s.autoLayout);
  const layouting = useMindMapStore((s) => s.layouting);
  const updateNodeColor = useMindMapStore((s) => s.updateNodeColor);
  const updateNodeProgress = useMindMapStore((s) => s.updateNodeProgress);

  const selected = useMindMapStore(getFocusedNode);
  const selectedNodes = nodes.filter((node) => node.selected);
  const sharedColor =
    selectedNodes.length === 0
      ? selected?.data.color
      : selectedNodes.every((node) => node.data.color === selectedNodes[0].data.color)
        ? selectedNodes[0].data.color
        : undefined;
  const hasSelection = selectedNodes.length > 0;
  const canCut = nodes.some((node) => node.selected && !node.data.isRoot);
  const canDelete = Boolean(selected && !selected.data.isRoot);

  return (
    <header className="editor-toolbar">
      <div className="toolbar-left">
        <Link href="/" className="back-link">
          <QMindMark size={26} />
          QMind
        </Link>
        <span className="toolbar-rule" />
        <input
          className="title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          aria-label="Map title"
        />
      </div>

      <div className="toolbar-center">
        <div className="layout-group">
          <button
            type="button"
            className="tool-btn compact"
            disabled={!canUndo}
            title="Undo (⌘Z)"
            onClick={() => undo()}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="tool-btn compact"
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            onClick={() => redo()}
          >
            <Redo2 size={15} />
          </button>
        </div>
        <button
          type="button"
          className="tool-btn"
          disabled={!selected}
          onClick={() => selected && addChildNode(selected.id)}
        >
          <Plus size={15} />
          Child
        </button>
        <button
          type="button"
          className="tool-btn"
          disabled={!canCut}
          onClick={() => cutSelection()}
        >
          <Scissors size={15} />
          Cut
        </button>
        <button
          type="button"
          className="tool-btn"
          disabled={!hasSelection}
          onClick={() => copySelection()}
        >
          <Copy size={15} />
          Copy
        </button>
        <button
          type="button"
          className="tool-btn"
          disabled={!clipboard || !hasSelection}
          onClick={() => pasteOntoSelection()}
        >
          <ClipboardPaste size={15} />
          Paste
        </button>
        <button
          type="button"
          className="tool-btn danger"
          disabled={!canDelete}
          onClick={() => deleteSelection()}
        >
          <Trash2 size={15} />
          Delete
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
            {layouting ? "Arranging" : "Arrange"}
          </button>
          <button
            type="button"
            className="tool-btn compact"
            disabled={layouting}
            title="Layout downward"
            onClick={() => void autoLayout("DOWN")}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="tool-btn compact"
            disabled={layouting}
            title="Radial layout"
            onClick={() => void autoLayout("RADIAL")}
          >
            <Orbit size={15} />
          </button>
        </div>
        <div className="color-row" role="group" aria-label="Node color">
          {COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-dot ${sharedColor === color ? "active" : ""}`}
              style={{ background: getColorSwatch(color) }}
              title={
                selectedNodes.length > 1
                  ? `Set ${color} on ${selectedNodes.length} nodes`
                  : color
              }
              disabled={!selected}
              onClick={() => selected && updateNodeColor(selected.id, color)}
            />
          ))}
        </div>
        <ProgressPicker
          value={selected?.data.progress}
          disabled={!selected}
          onChange={(progress) => selected && updateNodeProgress(selected.id, progress)}
        />
      </div>

      <div className="toolbar-right">
        <button
          type="button"
          className={`tool-btn${saveStatus === "dirty" || saveStatus === "error" ? " save-ready" : ""}`}
          disabled={saveStatus !== "dirty" && saveStatus !== "error"}
          title="Save (Ctrl+S)"
          onClick={onSave}
        >
          {saveStatus === "saving" ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Save size={15} />
          )}
          Save
        </button>
        <SaveBadge status={saveStatus} count={nodes.length} />
        <button type="button" className="icon-btn" onClick={onHelp} title="Shortcuts">
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
      ? "Saving"
      : status === "dirty"
        ? "Unsaved"
        : status === "error"
          ? "Save failed"
          : "Saved";

  return (
    <span className={`save-badge is-${status}`}>
      {status === "saving" ? (
        <LoaderCircle size={13} className="spin" />
      ) : (
        <Check size={13} />
      )}
      {label}
      <span className="count">
        {count} {count === 1 ? "node" : "nodes"}
      </span>
    </span>
  );
}
