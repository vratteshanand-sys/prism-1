/** Geometric prism mark — triangle with internal refraction. Shared by the sidebar and onboarding splash. */
export function PrismMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      {/* Outer triangle */}
      <path d="M16 4L30 27H2L16 4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      {/* Refraction lines — suggest spectrum without rainbow noise */}
      <path d="M16 12L21.5 27" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      <path d="M16 12L11 27" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.28" />
    </svg>
  );
}
