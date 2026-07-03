import { createElement } from "react";

export function Link({ to, children, ...props }: { to: string; children?: React.ReactNode }) {
  return createElement("a", { href: to, ...props }, children);
}
