import type { SVGProps } from "react";

/** Drawn icons so the Media Room looks identical on every platform (emoji sets differ). */
function Svg({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number; filled?: boolean };

export function ClapIcon({ size, filled }: IconProps) {
  return (
    <Svg size={size} fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.18 : 0}>
      <path d="M8.5 20.5c-2-1-3.5-3.2-3.5-5.6V9.2a1.5 1.5 0 0 1 3 0V12" />
      <path d="M8 12V6.2a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 11V5.2a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V7.2a1.5 1.5 0 0 1 3 0v6.6c0 3.4-2.6 6.7-6.2 6.7-.8 0-1.6-.1-2.3-.5" />
      <path d="M19.5 3.5 21 2M20.5 7H22.5M18 1.5v1.5" />
    </Svg>
  );
}

export function NewspaperIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 5h13v14H5.5A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M17 9h3v8.5a1.5 1.5 0 0 1-3 0" />
      <path d="M7 8.5h7M7 12h7M7 15.5h4" />
    </Svg>
  );
}

export function BellIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </Svg>
  );
}

export function BallotIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M9 10 9 6.5 13 3l3 3.5L15 10M8.5 15h7" />
    </Svg>
  );
}

export function PrinterIcon({ size = 28 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="8" rx="2" />
      <rect x="7" y="14" width="10" height="6.5" rx="1" />
    </Svg>
  );
}

export function ChevronIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={2}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={2.4}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}
