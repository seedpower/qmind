"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const DEFAULT_NOTES_RATIO = 1 / 3;
const MIN_CANVAS_PX = 280;
const MIN_NOTES_PX = 240;
const GUTTER_PX = 8;
const STORAGE_KEY = "qmind.editor-notes-ratio";
const STACK_QUERY = "(max-width: 900px)";

function clampNotesRatio(ratio: number, size: number) {
  const minNotes = Math.min(MIN_NOTES_PX, size * 0.35);
  const minCanvas = Math.min(MIN_CANVAS_PX, size * 0.45);
  const maxNotes = Math.max(minNotes, size - minCanvas - GUTTER_PX);
  const notesPx = Math.min(maxNotes, Math.max(minNotes, ratio * size));
  return notesPx / size;
}

function readStoredRatio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTES_RATIO;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0.18 || value > 0.7) {
      return DEFAULT_NOTES_RATIO;
    }
    return value;
  } catch {
    return DEFAULT_NOTES_RATIO;
  }
}

function persistRatio(ratio: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function setResizeCursor(on: boolean, stacked: boolean) {
  document.documentElement.classList.toggle("editor-resizing", on);
  document.documentElement.classList.toggle("editor-resizing-stacked", on && stacked);
}

export default function EditorWorkspace({
  canvas,
  notes,
}: {
  canvas: ReactNode;
  notes: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stackedRef = useRef(false);
  const notesRatioRef = useRef(DEFAULT_NOTES_RATIO);
  const draggingRef = useRef(false);
  const detachDragRef = useRef<(() => void) | null>(null);
  const [notesRatio, setNotesRatio] = useState(DEFAULT_NOTES_RATIO);
  const [resizing, setResizing] = useState(false);
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const stored = readStoredRatio();
    notesRatioRef.current = stored;
    setNotesRatio(stored);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(STACK_QUERY);
    const sync = () => {
      stackedRef.current = media.matches;
      setStacked(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const applyPointer = useCallback((client: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const stackedNow = stackedRef.current;
    const start = stackedNow ? rect.top : rect.left;
    const size = stackedNow ? rect.height : rect.width;
    if (size <= 0) return;
    const notesPx = size - (client - start) - GUTTER_PX / 2;
    const next = clampNotesRatio(notesPx / size, size);
    notesRatioRef.current = next;
    setNotesRatio(next);
    return next;
  }, []);

  const stopResize = useCallback(
    (client?: number, target?: HTMLElement | null) => {
      detachDragRef.current?.();
      detachDragRef.current = null;
      const wasDragging = draggingRef.current;
      draggingRef.current = false;
      setResizeCursor(false, false);
      setResizing(false);
      target?.blur();
      if (!wasDragging) return;
      const next =
        client === undefined ? notesRatioRef.current : applyPointer(client);
      if (next !== undefined) persistRatio(next);
    },
    [applyPointer],
  );

  useEffect(() => {
    return () => {
      detachDragRef.current?.();
      setResizeCursor(false, false);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    draggingRef.current = true;
    setResizeCursor(true, stackedRef.current);
    setResizing(true);
    applyPointer(stackedRef.current ? event.clientY : event.clientX);

    detachDragRef.current?.();
    const onMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      applyPointer(stackedRef.current ? moveEvent.clientY : moveEvent.clientX);
    };
    const onUp = (upEvent: Event) => {
      const point = upEvent instanceof PointerEvent ? upEvent : undefined;
      stopResize(
        point
          ? stackedRef.current
            ? point.clientY
            : point.clientX
          : undefined,
        target,
      );
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    detachDragRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
  };

  const resetSplit = () => {
    const root = rootRef.current;
    const size = root
      ? stackedRef.current
        ? root.getBoundingClientRect().height
        : root.getBoundingClientRect().width
      : 0;
    const next = size > 0 ? clampNotesRatio(DEFAULT_NOTES_RATIO, size) : DEFAULT_NOTES_RATIO;
    notesRatioRef.current = next;
    setNotesRatio(next);
    persistRatio(next);
  };

  const nudge = (direction: -1 | 1) => {
    const root = rootRef.current;
    const size = root
      ? stackedRef.current
        ? root.getBoundingClientRect().height
        : root.getBoundingClientRect().width
      : 900;
    const next = clampNotesRatio(notesRatio - direction * (24 / size), size);
    notesRatioRef.current = next;
    setNotesRatio(next);
    persistRatio(next);
  };

  return (
    <div
      ref={rootRef}
      className={`editor-workspace${resizing ? " is-resizing" : ""}`}
      style={
        { "--notes-pane": `${(notesRatio * 100).toFixed(3)}%` } as CSSProperties
      }
    >
      <div className="editor-canvas">{canvas}</div>
      <button
        type="button"
        className="editor-gutter"
        aria-label="Resize canvas and notes"
        aria-orientation={stacked ? "horizontal" : "vertical"}
        aria-valuemin={18}
        aria-valuemax={70}
        aria-valuenow={Math.round(notesRatio * 100)}
        onPointerDown={onPointerDown}
        onDoubleClick={resetSplit}
        onKeyDown={(event) => {
          if (stacked) {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              nudge(1);
            }
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudge(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            nudge(1);
          }
        }}
      >
        <span className="editor-gutter-bar" aria-hidden="true" />
        <span className="editor-gutter-knob" aria-hidden="true" />
      </button>
      {notes}
    </div>
  );
}
