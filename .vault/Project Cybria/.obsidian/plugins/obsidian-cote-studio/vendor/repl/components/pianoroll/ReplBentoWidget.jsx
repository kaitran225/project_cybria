export function RingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.25" />
      <ellipse cx="8" cy="8" rx="4" ry="4" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="3" height="3" fill="currentColor" opacity="0.9" />
      <rect x="6.5" y="2" width="3" height="3" fill="currentColor" opacity="0.55" />
      <rect x="11" y="2" width="3" height="3" fill="currentColor" opacity="0.35" />
      <rect x="2" y="6.5" width="3" height="3" fill="currentColor" opacity="0.55" />
      <rect x="6.5" y="6.5" width="3" height="3" fill="currentColor" opacity="0.9" />
      <rect x="11" y="6.5" width="3" height="3" fill="currentColor" opacity="0.55" />
      <rect x="2" y="11" width="3" height="3" fill="currentColor" opacity="0.35" />
      <rect x="6.5" y="11" width="3" height="3" fill="currentColor" opacity="0.55" />
      <rect x="11" y="11" width="3" height="3" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export function PianoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 3V13M8 3V13M11 3V13M2 8H14" stroke="currentColor" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

/** Shell-icon visibility only — no in-card header or collapse. */
export function ReplBentoWidget({
  className = '',
  bodyClassName = '',
  dotBg = false,
  children,
}) {
  return (
    <article
      className={`bento-card bento-card--surface bento-card--widget cote-repl-widget${className ? ` ${className}` : ''}`}
    >
      <div
        className={`cote-repl-widget__body${dotBg ? ' cote-repl-dot-bg' : ''}${bodyClassName ? ` ${bodyClassName}` : ''}`}
      >
        {children}
      </div>
    </article>
  );
}
