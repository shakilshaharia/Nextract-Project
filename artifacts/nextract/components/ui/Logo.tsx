import Image from "next/image";

/** Nextract wordmark exported from Figma (101 × 26.4, exported at 101 × 27). */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/images/brand/nextract-logo.svg"
      alt="Nextract"
      width={101}
      height={27}
    />
  );
}
