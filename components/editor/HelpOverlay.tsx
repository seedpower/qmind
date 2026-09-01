"use client";

export default function HelpOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="help-backdrop" onClick={onClose} role="presentation">
      <div
        className="help-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="help-title"
      >
        <h2 id="help-title">Canvas shortcuts</h2>
        <ul>
          <li>
            <kbd>Drag on empty space</kbd>
            <span>Box-select nodes</span>
          </li>
          <li>
            <kbd>Right-drag</kbd>
            <span>Pan the canvas</span>
          </li>
          <li>
            <kbd>Space + drag</kbd>
            <span>Pan the canvas</span>
          </li>
          <li>
            <kbd>Shift + click</kbd>
            <span>Add or remove from selection</span>
          </li>
          <li>
            <kbd>Right-click a node</kbd>
            <span>Create, delete, color, and progress</span>
          </li>
          <li>
            <kbd>Double-click a node</kbd>
            <span>Edit the label</span>
          </li>
          <li>
            <kbd>Drag to empty space</kbd>
            <span>Pull a child node from the handle</span>
          </li>
          <li>
            <kbd>Drop beside a sibling</kbd>
            <span>Reorder siblings on release</span>
          </li>
          <li>
            <kbd>↑ ↓ ← →</kbd>
            <span>Move selection among parent, child, and siblings</span>
          </li>
          <li>
            <kbd>Tab</kbd>
            <span>Add a child, then auto-layout</span>
          </li>
          <li>
            <kbd>Enter</kbd>
            <span>Add a sibling below the selection, then auto-layout</span>
          </li>
          <li>
            <kbd>Delete</kbd>
            <span>Delete the subtree and re-layout</span>
          </li>
          <li>
            <kbd>L</kbd>
            <span>ELK layout to the right; Shift+L for radial</span>
          </li>
          <li>
            <kbd>⌘ / Ctrl + S</kbd>
            <span>Save now</span>
          </li>
          <li>
            <kbd>?</kbd>
            <span>Show or hide this guide</span>
          </li>
        </ul>
        <button type="button" className="tool-btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
