import { useId } from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Deckhouse logo mark — deckhouse cabin with portholes over stacked containers.
 * Uses currentColor so it can be tinted via the parent's text-color utility.
 */
export function Logo({ size = 32, className }: LogoProps) {
  const id = useId();
  const maskId = `${id}-cabin`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          {/* Cabin shape (white = visible) */}
          <rect x="104" y="146" width="304" height="128" rx="14" fill="white" />
          {/* Porthole cutouts (black = transparent) */}
          <circle cx="192" cy="210" r="24" fill="black" />
          <circle cx="256" cy="210" r="24" fill="black" />
          <circle cx="320" cy="210" r="24" fill="black" />
        </mask>
      </defs>

      {/* Chimney */}
      <rect x="168" y="94" width="36" height="62" rx="6" fill="currentColor" />

      {/* Cabin with porthole cutouts */}
      <rect
        x="104" y="146" width="304" height="128" rx="14"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />

      {/* Container layer 1 */}
      <rect x="104" y="298" width="304" height="52" rx="10" fill="currentColor" />

      {/* Container layer 2 */}
      <rect x="104" y="364" width="304" height="52" rx="10" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
