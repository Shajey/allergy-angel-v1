/**
 * Inline shield + heart mark — avoids a separate /icons fetch (reliable in dev + with SW).
 * Kept in sync with public/icons/icon.svg.
 */
export default function AllergyAngelMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <path
        d="M32 2L6 14v20c0 16 12 26 26 32 14-6 26-16 26-32V14L32 2z"
        fill="#dc2626"
      />
      <path
        d="M32 22c-3-3-8-3-11 0-3 3-3 8 0 11l11 11 11-11c3-3 3-8 0-11-3-3-8-3-11 0z"
        fill="white"
      />
    </svg>
  );
}
