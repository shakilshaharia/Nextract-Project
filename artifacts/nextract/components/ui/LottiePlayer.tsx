"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

type LottiePlayerProps = {
  src: string;
  className?: string;
  ariaLabel?: string;
  loop?: boolean;
  autoplay?: boolean;
};

/**
 * Renders a Lottie animation (lottie-web, SVG renderer) in place of a static
 * illustration. The JSON is fetched from `src` (a path under /public) so the
 * animation data stays out of the JS bundle.
 */
export function LottiePlayer({
  src,
  className,
  ariaLabel,
  loop = true,
  autoplay = true,
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let anim: AnimationItem | undefined;
    let cancelled = false;

    // lottie-web pulls in browser-only globals, so load it on the client.
    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay,
        path: src,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
    });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [src, loop, autoplay]);

  return (
    <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />
  );
}
