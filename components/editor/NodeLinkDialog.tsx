"use client";

import { Link2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFocusedNode, useMindMapStore } from "@/store/useMindMapStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NodeLinkDialog({ open, onClose }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeId = useMindMapStore((s) =>
    open ? getFocusedNode(s)?.id ?? null : null,
  );
  const nodeLink = useMindMapStore((s) => {
    if (!open || !nodeId) return "";
    return s.nodes.find((node) => node.id === nodeId)?.data.link ?? "";
  });
  const selectedCount = useMindMapStore((s) =>
    open ? s.nodes.reduce((count, item) => count + (item.selected ? 1 : 0), 0) : 0,
  );
  const nodeSelected = useMindMapStore((s) =>
    open && nodeId
      ? Boolean(s.nodes.find((node) => node.id === nodeId)?.selected)
      : false,
  );
  const updateNodeLink = useMindMapStore((s) => s.updateNodeLink);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(nodeLink);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, nodeId, nodeLink]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !nodeId) return null;

  const applyToMany = nodeSelected && selectedCount > 1;

  function apply(next: string) {
    updateNodeLink(nodeId!, next);
    onClose();
  }

  return createPortal(
    <div className="link-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply(value);
          }
        }}
      >
        <div className="link-dialog-header">
          <h2 id={titleId}>
            <Link2 size={16} aria-hidden />
            {applyToMany ? `Add link (${selectedCount})` : "Add link"}
          </h2>
          <button
            type="button"
            className="link-dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <p className="link-dialog-hint">
          {applyToMany
            ? "Set the same URL on every selected node. Leave empty to clear."
            : "Paste a URL for this node. Leave empty to clear."}
        </p>
        <input
          ref={inputRef}
          className="link-dialog-input"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          value={value}
          maxLength={2000}
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
        />
        <div className="link-dialog-actions">
          <button
            type="button"
            className="tool-btn"
            disabled={!nodeLink && !value.trim()}
            onClick={() => apply("")}
          >
            Clear
          </button>
          <button
            type="button"
            className="tool-btn primary"
            onClick={() => apply(value)}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
