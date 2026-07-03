import { useEffect, useRef, useState, type ReactNode } from "react";

export function OverflowMenu({
  label = "⋮",
  ariaLabel = "More options",
  children,
  className,
  align = "right",
}: {
  label?: string;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div
      className={`overflow-menu${className ? ` ${className}` : ""}${align === "left" ? " overflow-menu--left" : ""}`}
      ref={ref}
    >
      <button
        type="button"
        className="overflow-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="overflow-menu-dropdown" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
