type Props = {
  size?: number;
  className?: string;
};

export default function QMindMark({ size = 28, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16 0a16 16 0 1 1 0 32 16 16 0 1 1 0-32ZM9 8.8h3.4L16 16.2 19.6 8.8H23v14.4h-3.15V13.5L16.75 21h-1.5L12.15 13.5v9.7H9V8.8Z"
      />
    </svg>
  );
}
