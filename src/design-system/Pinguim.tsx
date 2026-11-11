/** Pinguim estilizado (placeholder): traço único marinho com detalhe ouro. Decorativo. */
export function Pinguim({ className = "size-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      <path
        d="M32 6c-9 0-15 7-15 17v12c0 9 5 17 6 21h18c1-4 6-12 6-21V23C47 13 41 6 32 6Z M25 24c0-4 3-7 7-7s7 3 7 7v14c0 6-3 11-7 11s-7-5-7-11V24Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="28.5" cy="22" r="1.4" fill="currentColor" />
      <circle cx="35.5" cy="22" r="1.4" fill="currentColor" />
      <path
        d="M29 26.5 32 29l3-2.5"
        stroke="var(--color-ouro)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 57h7M33 57h7"
        stroke="var(--color-ouro)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
