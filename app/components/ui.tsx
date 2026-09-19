import type { ReactNode } from "react";
import Link from "next/link";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link
      className={`inline-flex items-center gap-1.5 font-mono text-[25px] font-semibold tracking-[-0.07em] text-ink no-underline ${className}`}
      href="/"
    >
      <span>OBRA</span>
      <i className="grid size-[18px] place-items-center rounded-full bg-safety font-mono text-[11px] not-italic tracking-normal text-ink">
        β
      </i>
    </Link>
  );
}

export function Masthead({
  module,
  children,
  className = "",
}: {
  module: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`relative z-10 -mx-[5vw] flex h-16 items-center border-b-2 border-ink bg-paper/90 px-[5vw] max-sm:-mx-5 max-sm:h-[59px] max-sm:px-5 ${className}`}
    >
      <Brand />
      <span className="order-1 ml-6 font-mono text-[10px] font-medium max-sm:hidden">
        {module}
      </span>
      {children}
    </header>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3.5 inline-flex items-center gap-2 font-mono text-[11px] uppercase">
      <span className="size-[9px] bg-safety" />
      {children}
    </p>
  );
}

export const languageButton =
  "border border-ink bg-paper px-2.5 py-[7px] font-mono text-[10px] text-ink";
export const sourceBadge = "px-2 py-1.5 font-mono text-[10px] font-bold";
export const primaryButton =
  "border border-ink bg-ink px-3 py-2 font-mono text-[10px] uppercase text-white disabled:cursor-not-allowed disabled:opacity-40";
