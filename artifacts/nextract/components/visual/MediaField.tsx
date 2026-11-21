"use client";
/* eslint-disable @next/next/no-img-element -- Arbitrary media library thumbnails have variable dimensions. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { safeVisualUrl, type VisualImage } from "@workspace/cms-content";
export type Asset = {
  id: string;
  url: string;
  alt: string;
  filename: string;
  kind: string;
};
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "X-Nextract-CSRF": "1",
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new RequestError(
      [
        data.error?.message || `Request failed (${res.status})`,
        ...Object.entries(data.error?.fields ?? {})
          .slice(0, 3)
          .map(([field, message]) => `${field}: ${message}`),
      ].join(" "),
      res.status,
    );
  return data as T;
}
export function MediaField({
  value = "",
  onChange,
  onSelect,
  kind = "image",
}: {
  value?: string;
  onChange: (v: string) => void;
  onSelect?: (v: Asset) => void;
  kind?: "image" | "video";
}) {
  const [open, setOpen] = useState(false),
    [address, setAddress] = useState(value),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [items, setItems] = useState<Asset[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Asset>(),
    [tab, setTab] = useState<"library" | "upload" | "url">("library");
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        fetch(
          `/api/admin/media?kind=${kind}&pageSize=60&page=${page}&q=${encodeURIComponent(q)}`,
          {
            signal: controller.signal,
            credentials: "same-origin",
            cache: "no-store",
          },
        )
          .then(async (r) => {
            if (!r.ok) throw new Error("Could not load the Media Library.");
            return r.json();
          })
          .then((r) => {
            setItems(r.items);
            setPages(r.pages);
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(e.message);
          }),
      200,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, q, kind, page]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError(
        "Choose a file under 20 MB. Use a hosted link for larger videos.",
      );
      return;
    }
    if (
      !(
        kind === "image"
          ? /^image\/(jpeg|png|webp|avif|gif|svg\+xml)$/
          : /^video\/(mp4|webm)$/
      ).test(file.type)
    ) {
      setError("That file type is not supported.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("files", file);
      const r = await request<{
        items: Asset[];
        failed: { message: string }[];
      }>("/api/admin/media", "POST", body);
      if (!r.items[0])
        throw new Error(r.failed[0]?.message || "Upload failed.");
      setSelected(r.items[0]);
      setTab("library");
      setItems((previous) => [r.items[0], ...previous]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="visual-media">
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setError("");
          setSelected(undefined);
          setAddress(value);
          setTab("library");
          setOpen(true);
        }}
      >
        {value ? `Replace ${kind}` : `Choose ${kind}`}
      </button>
      {value &&
        (kind === "image" ? (
          <img
            src={value}
            alt="Selected image"
            className="visual-media-current"
          />
        ) : (
          <video
            src={value}
            muted
            controls
            preload="metadata"
            className="visual-media-current"
          />
        ))}
      {value && (
        <button type="button" onClick={() => onChange("")}>
          Remove {kind}
        </button>
      )}
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="visual-media-dialog"
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onClose={() => setOpen(false)}
            aria-labelledby="media-library-title"
          >
            <header>
              <h2 id="media-library-title">
                Choose {kind === "image" ? "an image" : "a video"}
              </h2>
              <button type="button" onClick={close}>
                Close
              </button>
            </header>
            <nav aria-label="Media source">
              {(["library", "upload", "url"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t === "library"
                    ? "Media Library"
                    : t === "upload"
                      ? "Upload new"
                      : kind === "video"
                        ? "Video link"
                        : "Image address"}
                </button>
              ))}
            </nav>
            {error && (
              <p role="alert" className="visual-field-error">
                {error}
              </p>
            )}
            {tab === "upload" ? (
              <label className="visual-upload">
                Choose a {kind} file (up to 20 MB)
                <input
                  type="file"
                  disabled={busy}
                  accept={
                    kind === "image"
                      ? "image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                      : "video/mp4,video/webm"
                  }
                  onChange={(e) => void upload(e.target.files?.[0])}
                />
                {busy
                  ? "Uploading…"
                  : "Files are checked before they enter your Media Library."}
              </label>
            ) : tab === "url" ? (
              <div className="visual-field">
                <label>
                  {kind === "video"
                    ? "YouTube, Vimeo, or hosted video URL"
                    : "Image URL"}
                  <input
                    value={address}
                    placeholder="https://…"
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = address.trim();
                    if (
                      !/^(https?:\/\/|\/(?!\/))/i.test(next) ||
                      !safeVisualUrl.safeParse(next).success
                    ) {
                      setError(
                        "Enter a full http or https address, or a path starting with /.",
                      );
                      return;
                    }
                    onChange(next);
                    close();
                  }}
                >
                  Use this address
                </button>
              </div>
            ) : (
              <>
                <input
                  aria-label="Search media"
                  placeholder="Search by name or description"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
                <div className="visual-media-grid">
                  {items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      aria-pressed={selected?.id === i.id}
                      onClick={() => setSelected(i)}
                    >
                      {kind === "image" ? (
                        <img src={i.url} alt={i.alt} />
                      ) : (
                        <video src={i.url} muted preload="metadata" />
                      )}
                      <span>{i.filename}</span>
                    </button>
                  ))}
                </div>
                {!items.length && (
                  <p>No matching files. Try uploading a new {kind}.</p>
                )}
                <nav aria-label="Media pages">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {pages}
                  </span>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </nav>
              </>
            )}
            {selected && (
              <footer>
                <strong>{selected.filename}</strong>
                {kind === "image" && (
                  <label>
                    Image description (alt text)
                    <input
                      value={selected.alt}
                      onChange={(e) =>
                        setSelected({ ...selected, alt: e.target.value })
                      }
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="visual-primary"
                  onClick={() => {
                    onChange(selected.url);
                    onSelect?.(selected);
                    close();
                  }}
                >
                  Use this {kind}
                </button>
              </footer>
            )}
          </dialog>,
          document.body,
        )}
    </div>
  );
}
export function ImageProperties({
  value,
  onChange,
  allowCrop = true,
}: {
  value: VisualImage;
  onChange: (v: VisualImage) => void;
  allowCrop?: boolean;
}) {
  const v = value ?? {
    src: "",
    alt: "",
    focalX: 50,
    focalY: 50,
    ratio: "original",
  };
  return (
    <div className="visual-field">
      <MediaField
        value={v.src}
        onChange={(src) => onChange({ ...v, src })}
        onSelect={(asset) => onChange({ ...v, src: asset.url, alt: asset.alt })}
      />
      <label>
        Image description
        <input
          value={v.alt}
          onChange={(e) => onChange({ ...v, alt: e.target.value })}
        />
        <small>
          Describe the image for screen readers. Leave empty for a decorative
          image.
        </small>
      </label>
      {allowCrop && (
        <>
          <label>
            Image shape
            <select
              value={v.ratio}
              onChange={(e) =>
                onChange({
                  ...v,
                  ratio: e.target.value as VisualImage["ratio"],
                })
              }
            >
              <option value="original">Original</option>
              <option value="16/9">Wide</option>
              <option value="4/3">Landscape</option>
              <option value="1/1">Square</option>
              <option value="3/4">Portrait</option>
            </select>
          </label>
          {v.src && (
            <>
              <button
                type="button"
                className="visual-focal"
                aria-label="Click the important part of the image"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onChange({
                    ...v,
                    focalX: Math.round(((e.clientX - r.left) / r.width) * 100),
                    focalY: Math.round(((e.clientY - r.top) / r.height) * 100),
                  });
                }}
              >
                <img
                  src={v.src}
                  alt={v.alt}
                  style={{
                    aspectRatio: v.ratio === "original" ? undefined : v.ratio,
                    objectFit: "cover",
                    objectPosition: `${v.focalX}% ${v.focalY}%`,
                  }}
                />
                <span style={{ left: `${v.focalX}%`, top: `${v.focalY}%` }}>
                  +
                </span>
              </button>
              <small>
                Click the important part to keep it visible when cropped. The
                original file is preserved.
              </small>
              <label>
                Horizontal focus
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={v.focalX}
                  onChange={(e) =>
                    onChange({ ...v, focalX: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Vertical focus
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={v.focalY}
                  onChange={(e) =>
                    onChange({ ...v, focalY: Number(e.target.value) })
                  }
                />
              </label>
            </>
          )}
        </>
      )}
    </div>
  );
}
export function ImageReference({
  value = {},
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const key = "src" in value ? "src" : "url";
  return (
    <div className="visual-field">
      <MediaField
        value={String(value[key] ?? "")}
        onChange={(src) => onChange({ ...value, [key]: src })}
        onSelect={(asset) =>
          onChange({ ...value, [key]: asset.url, alt: asset.alt })
        }
      />
      <label>
        Image description
        <input
          value={String(value.alt ?? "")}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
        />
      </label>
    </div>
  );
}
