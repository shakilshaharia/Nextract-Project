"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { visualLayoutSchema, type VisualLayout } from "@workspace/cms-content";
import type { CmsBootstrap, CmsResourceSummary } from "@/lib/cms";
import { migratePage } from "./website";
import { request, RequestError } from "./MediaField";

export type EditorPayload = {
  editorId: string;
  page: {
    id: string;
    title: string;
    path: string;
    slug: string;
    status: string;
  };
  layout: VisualLayout | null;
  version: number;
  bootstrap: CmsBootstrap;
  canPublish: boolean;
  revisions: {
    id: string;
    action: string;
    createdAt: string;
    createdByName: string;
  }[];
};
type Recovery = { layout: VisualLayout; version: number; at: string };
export function useVisualDraft(id: string) {
  const [payload, setPayload] = useState<EditorPayload>(),
    [data, setData] = useState<VisualLayout>(),
    [saved, setSaved] = useState(""),
    [generation, setGeneration] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Loading draft…"),
    [saving, setSaving] = useState(false),
    [paused, setPaused] = useState(false),
    [recovery, setRecovery] = useState<Recovery>(),
    [storageWarning, setStorageWarning] = useState("");
  const current = useRef<{
      data: VisualLayout;
      version: number;
      key: string;
      saved: string;
    }>(undefined),
    flight = useRef<Promise<number> | null>(null);
  const load = useCallback(async () => {
    const p = await request<EditorPayload>(`/api/admin/pages/${id}/visual`);
    const resources =
      p.page.slug === "resources"
        ? (
            await request<{ items: CmsResourceSummary[] }>(
              "/api/public/resources",
            )
          ).items
        : null;
    p.bootstrap.resources = resources;
    const d = p.layout ?? migratePage(p.bootstrap, resources);
    // Upgrade older image blocks without changing their existing source.
    const upgrade = (blocks: VisualLayout["content"]) =>
      blocks.forEach((b) => {
        if (b.type === "Image" && !b.props.image)
          b.props.image = {
            src: b.props.src ?? "",
            alt: b.props.alt ?? "",
            focalX: 50,
            focalY: 50,
            ratio: "original",
          };
        upgrade(b.props.children ?? []);
      });
    upgrade(d.content);
    const key = `nextract-visual:${p.editorId}:${id}`,
      serialized = JSON.stringify(d);
    current.current = { data: d, version: p.version, key, saved: serialized };
    setPayload(p);
    setData(d);
    setSaved(serialized);
    setGeneration((g) => g + 1);
    setPaused(false);
    setError("");
    setStatus("All changes saved");
    setRecovery(undefined);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const candidate = JSON.parse(raw) as Recovery;
        if (
          visualLayoutSchema.safeParse(candidate.layout).success &&
          typeof candidate.version === "number" &&
          typeof candidate.at === "string" &&
          JSON.stringify(candidate.layout) !== serialized
        )
          setRecovery(candidate);
      }
    } catch {
      setStorageWarning(
        "Browser recovery is unavailable. Save Draft still stores your changes on the server.",
      );
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) return load();
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [load]);
  const persist = useCallback(() => {
    const c = current.current;
    if (!c) return;
    try {
      localStorage.setItem(
        c.key,
        JSON.stringify({
          layout: c.data,
          version: c.version,
          at: new Date().toISOString(),
        }),
      );
    } catch {
      setStorageWarning(
        "Browser recovery storage is full or disabled. Keep this tab open until the draft is saved.",
      );
    }
  }, []);
  const change = useCallback(
    (layout: VisualLayout) => {
      if (!current.current) return;
      if (JSON.stringify(layout) === JSON.stringify(current.current.data))
        return;
      current.current.data = layout;
      setData(layout);
      persist();
    },
    [persist],
  );
  const save = useCallback(
    (mode: "manual" | "auto" = "manual"): Promise<number> => {
      if (flight.current) return flight.current;
      const c = current.current;
      if (!c) return Promise.reject(new Error("The page has not loaded."));
      const captured = structuredClone(c.data),
        serialized = JSON.stringify(captured),
        version = c.version;
      if (mode === "auto" && serialized === c.saved)
        return Promise.resolve(version);
      setSaving(true);
      setStatus("Saving…");
      setError("");
      const operation = request<{ version: number; layout: VisualLayout }>(
        `/api/admin/pages/${id}/visual`,
        "PATCH",
        { layout: captured, version, saveMode: mode },
      )
        .then((result) => {
          c.version = result.version;
          const canonical = JSON.stringify(result.layout);
          c.saved = canonical;
          if (JSON.stringify(c.data) === serialized) {
            c.data = result.layout;
            setData(result.layout);
          }
          setSaved(canonical);
          setPaused(false);
          setStatus("All changes saved");
          persist();
          return result.version;
        })
        .catch((e) => {
          setPaused(true);
          setStatus(
            e instanceof RequestError && e.status === 409
              ? "Another editor changed this page"
              : "Draft not saved",
          );
          setError(e.message);
          throw e;
        })
        .finally(() => {
          flight.current = null;
          setSaving(false);
        });
      flight.current = operation;
      return operation;
    },
    [id, persist],
  );
  const flush = useCallback(async () => {
    if (flight.current) await flight.current;
    let version = await save("manual");
    // Edits made while a save was in flight must reach the database before publish.
    while (
      current.current &&
      JSON.stringify(current.current.data) !== current.current.saved
    )
      version = await save("manual");
    return version;
  }, [save]);
  const dirty = !!data && JSON.stringify(data) !== saved;
  useEffect(() => {
    if (!dirty || saving || paused || recovery) return;
    const timer = setTimeout(() => {
      void save("auto").catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [dirty, data, saving, paused, recovery, save]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      const c = current.current;
      if (c && JSON.stringify(c.data) !== c.saved) {
        persist();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [persist]);
  const discardRecovery = () => {
    setRecovery(undefined);
    persist();
  };
  const recover = () => {
    if (!recovery || !current.current) return;
    if (recovery.version !== current.current.version) {
      setError(
        "This recovery copy is older than the server draft. Download it before discarding it, or keep the current server draft.",
      );
      return;
    }
    change(recovery.layout);
    setGeneration((g) => g + 1);
    setRecovery(undefined);
    setStatus("Recovered changes — saving as draft");
  };
  const refreshHistory = async () => {
    const fresh = await request<EditorPayload>(`/api/admin/pages/${id}/visual`);
    setPayload((p) => (p ? { ...p, revisions: fresh.revisions } : p));
  };
  const restore = async (revision: string) => {
    if (flight.current) await flight.current;
    await request(`/api/admin/pages/${id}/visual/restore/${revision}`, "POST", {
      version: current.current?.version,
    });
    const c = current.current;
    if (c) {
      try {
        localStorage.removeItem(c.key);
      } catch {
        /* Server restore works even when browser storage is disabled. */
      }
    }
    await load();
    setStatus("Earlier version restored as draft");
  };
  return {
    payload,
    data,
    generation,
    error,
    setError,
    status,
    setStatus,
    saving,
    dirty,
    paused,
    recovery,
    storageWarning,
    load,
    change,
    flush,
    save,
    refreshHistory,
    restore,
    recover,
    discardRecovery,
  };
}
