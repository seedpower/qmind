"use client";

import { PROGRESS_STEPS, type NodeProgress } from "@/lib/types";

const RING_R = 6;
const RING_C = 2 * Math.PI * RING_R;

export function ProgressRing({
  progress,
  size = 16,
}: {
  progress: NodeProgress;
  size?: number;
}) {
  const done = progress === 100;
  const offset = RING_C * (1 - progress / 100);

  return (
    <svg
      className={`progress-ring ${done ? "is-done" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
    >
      <circle className="progress-ring-track" cx="8" cy="8" r={RING_R} />
      {done ? (
        <>
          <circle className="progress-ring-fill" cx="8" cy="8" r={RING_R} />
          <path className="progress-ring-check" d="M4.8 8.1 7 10.2l4.3-5" />
        </>
      ) : progress > 0 ? (
        <circle
          className="progress-ring-value"
          cx="8"
          cy="8"
          r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          transform="rotate(-90 8 8)"
        />
      ) : null}
    </svg>
  );
}

export function ProgressPicker({
  value,
  disabled,
  onChange,
}: {
  value?: NodeProgress;
  disabled?: boolean;
  onChange: (progress: NodeProgress | undefined) => void;
}) {
  return (
    <div className="progress-row" role="group" aria-label="节点进度">
      <button
        type="button"
        className={`progress-dot ${value == null ? "active" : ""}`}
        title="无进度"
        aria-label="无进度"
        disabled={disabled}
        onClick={() => onChange(undefined)}
      >
        <span className="progress-none" />
      </button>
      {PROGRESS_STEPS.map((step) => (
        <button
          key={step}
          type="button"
          className={`progress-dot ${value === step ? "active" : ""}`}
          title={`${step}%`}
          aria-label={`进度 ${step}%`}
          disabled={disabled}
          onClick={() => onChange(value === step ? undefined : step)}
        >
          <ProgressRing progress={step} />
        </button>
      ))}
    </div>
  );
}
