import { useState } from "react";

export function SectionThumbnail({ image }: { image?: string }) {
  const [failed, setFailed] = useState<string>();
  return (
    <span
      className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
      aria-hidden="true"
    >
      {image && failed !== image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(image)}
        />
      ) : (
        <svg viewBox="0 0 80 56" className="h-full w-full" fill="none">
          <rect
            x="9"
            y="10"
            width="62"
            height="36"
            rx="4"
            fill="white"
            stroke="#e4e4e7"
          />
          <rect x="15" y="17" width="29" height="4" rx="2" fill="#1f3f5c" />
          <rect x="15" y="25" width="24" height="2" rx="1" fill="#cbd5e1" />
          <rect x="15" y="30" width="21" height="2" rx="1" fill="#cbd5e1" />
          <rect x="15" y="36" width="16" height="4" rx="2" fill="#0082fb" />
          <rect x="49" y="17" width="16" height="23" rx="3" fill="#dbeafe" />
        </svg>
      )}
    </span>
  );
}
