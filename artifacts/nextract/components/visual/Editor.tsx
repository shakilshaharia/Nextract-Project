"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- /admin belongs to the separate CMS SPA and needs a full navigation. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Puck, createUsePuck, type Data, type Overrides } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  reviewVisual,
  type VisualBlock,
  type VisualLayout,
} from "@workspace/cms-content";
import type { CmsBootstrap } from "@/lib/cms";
import { makeConfig, type EditorMode } from "./config";
import { request } from "./MediaField";
import { VisualPage } from "./Renderer";
import { SectionLibrary } from "./SectionLibrary";
import { useVisualDraft } from "./useVisualDraft";
import "./editor.css";
import { disabledFeatures } from "@/config/disabled-features";

type Draft = ReturnType<typeof useVisualDraft>;
const useEditorPuck = createUsePuck();
// Puck uses these identities in its viewport initialization effect, which also
// seeds history. Recreating them while saving can overwrite the undo baseline.
const editorViewports = [
  { width: 1280, height: "auto" as const, label: "Desktop" },
  { width: 834, height: "auto" as const, label: "Tablet" },
  { width: 390, height: "auto" as const, label: "Mobile" },
];
const contentEditorUi = {
  viewports: {
    current: { width: 1280, height: "auto" as const },
    options: editorViewports,
    controlsVisible: false,
  },
};
const editorIframe = {
  enabled: true,
  syncHostStyles: true,
  waitForStyles: true,
};

// Live editor state for the Puck overrides below. The overrides themselves are
// module-level constants: if they were inline functions, every edit (which
// re-renders Editor) would give them a new identity, React would treat them as
// new component types, and the whole fields panel and canvas would remount —
// dropping focus and the caret mid-typing. Reading state from context lets them
// re-render in place instead.
type EditorShell = {
  draft: Draft;
  mode: EditorMode;
  allowDesign: boolean;
  setMode: (m: EditorMode) => void;
  busy: boolean;
  onSave: () => void;
  onPreview: () => void;
  onHistory: () => void;
  onReview: () => void;
};
const EditorShellContext = createContext<EditorShell | null>(null);
function useEditorShell() {
  const shell = useContext(EditorShellContext);
  if (!shell) throw new Error("Editor overrides must render inside the editor.");
  return shell;
}
function HeaderOverride() {
  const shell = useEditorShell();
  return (
    <>
      <OpenRequestedSection />
      <EditorToolbar {...shell} />
    </>
  );
}
function FieldsOverride({ children }: { children: ReactNode }) {
  const { mode, busy, draft } = useEditorShell();
  return (
    <>
      <SharedContentNotice />
      {mode === "design" && <BlockPosition disabled={busy || !!draft.recovery} />}
      {children}
    </>
  );
}
function DrawerOverride({ children }: { children?: ReactNode }) {
  const { mode, allowDesign } = useEditorShell();
  if (mode !== "content") return <>{children}</>;
  return (
    <div className="visual-selection-help">
      <strong>Edit the page you see</strong>
      <p>
        Click a heading to type directly. Select a section to edit its text,
        images, or videos.
        {allowDesign && " Switch to Design to add or move sections."}
      </p>
    </div>
  );
}
function IframeOverride({ children, document: doc }: { children: ReactNode; document?: Document }) {
  return <CanvasDocument doc={doc}>{children}</CanvasDocument>;
}
const editorOverrides: Partial<Overrides> = {
  header: HeaderOverride,
  fields: FieldsOverride,
  drawer: DrawerOverride,
  iframe: IframeOverride,
};
export default function Editor({
  id,
  allowDesign = !disabledFeatures.visualBuilderDesign,
}: {
  id: string;
  allowDesign?: boolean;
}) {
  const draft = useVisualDraft(id);
  const [requestedMode, setMode] = useState<EditorMode>("content"),
    [preview, setPreview] = useState(false),
    [width, setWidth] = useState(1280),
    [history, setHistory] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mode = allowDesign ? requestedMode : "content";
  const config = useMemo(
    () => makeConfig(draft.payload?.bootstrap ?? null, mode, allowDesign),
    [draft.payload?.bootstrap, mode, allowDesign],
  );
  const issues = useMemo(
    () => (draft.data ? reviewVisual(draft.data) : []),
    [draft.data],
  );
  const locked = busy || !!draft.recovery;
  const permissions = useMemo(
    () => ({
      publish: false,
      insert: mode === "design" && !locked,
      delete: mode === "design" && !locked,
      duplicate: mode === "design" && !locked,
      drag: mode === "design" && !locked,
      edit: !locked,
    }),
    [mode, locked],
  );
  const action = async (kind: "save" | "preview" | "publish") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    draft.setError("");
    try {
      const version = await draft.flush();
      if (kind === "publish") {
        await request(`/api/admin/pages/${id}/publish`, "POST", {
          visualVersion: version,
        });
        draft.setStatus("Published — visitors now see this version");
        setReview(false);
        await draft.refreshHistory();
      }
      if (kind === "preview") setPreview(true);
    } catch (e) {
      draft.setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!draft.payload || !draft.data)
    return (
      <div className="visual-loading">
        <h1>{draft.error ? "Cannot open this page" : "Opening your page…"}</h1>
        {draft.error && (
          <>
            <p role="alert">{draft.error}</p>
            <a href="/admin">Return to dashboard</a>
            <button
              onClick={() =>
                void draft.load().catch((e) => draft.setError(e.message))
              }
            >
              Try again
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className={`visual-editor visual-mode-${mode}`}>
      <div className="visual-guidance">
        <strong>
          {mode === "content"
            ? "Click text to edit, or select a section to change its images and videos."
            : "Design mode: add sections, rearrange the page, and adjust its appearance."}
        </strong>
        <span>
          Drafts are only visible to you and other editors until published.
        </span>
      </div>
      {draft.error && (
        <div className="visual-error" role="alert">
          <span>{draft.error}</span>
          <button disabled={draft.saving} onClick={() => void action("save")}>
            Retry save
          </button>
          <button
            disabled={draft.saving}
            onClick={() => {
              if (
                !draft.dirty ||
                window.confirm(
                  "Reload the server draft? Unsaved changes remain in browser recovery.",
                )
              )
                void draft.load().catch((e) => draft.setError(e.message));
            }}
          >
            Reload server draft
          </button>
          <button onClick={() => draft.setError("")}>Dismiss</button>
        </div>
      )}
      {draft.storageWarning && (
        <p className="visual-storage-warning" role="status">
          {draft.storageWarning}
        </p>
      )}
      {draft.recovery && (
        <section
          className="visual-recovery"
          aria-label="Recover unsaved changes"
        >
          <strong>
            Unsaved changes found from{" "}
            {new Date(draft.recovery.at).toLocaleString()}
          </strong>
          <p>
            {draft.recovery.version === draft.payload.version
              ? "Recover your last editing session as a draft."
              : "The server has a newer version. Download your recovery copy before keeping the server draft."}
          </p>
          <button
            disabled={draft.recovery.version !== draft.payload.version}
            onClick={draft.recover}
          >
            Recover changes
          </button>
          <button
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify(draft.recovery?.layout, null, 2)],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "page-recovery.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download recovery copy
          </button>
          <button onClick={draft.discardRecovery}>Keep server draft</button>
        </section>
      )}
      <div
        className="visual-editor-canvas"
        data-preview-hidden={preview}
        aria-hidden={preview}
        inert={preview}
      >
        <EditorShellContext.Provider
          value={{
            draft,
            mode,
            allowDesign,
            setMode,
            busy,
            onSave: () => void action("save"),
            onPreview: () => void action("preview"),
            onHistory: () => {
              setHistory(true);
              void draft
                .refreshHistory()
                .catch((e) => draft.setError(e.message));
            },
            onReview: () => setReview(true),
          }}
        >
          <Puck
            key={draft.generation}
            config={config}
            data={draft.data as unknown as Data}
            onChange={(d) => draft.change(d as unknown as VisualLayout)}
            permissions={permissions}
            viewports={editorViewports}
            ui={allowDesign ? undefined : contentEditorUi}
            iframe={editorIframe}
            overrides={editorOverrides}
          />
        </EditorShellContext.Provider>
      </div>
      {preview && (
        <>
          <header className="visual-preview-toolbar">
            <strong>Private draft preview</strong>
            <span>This is your saved draft. It is not published.</span>
            <select
              aria-label="Preview viewport"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            >
              <option value={1280}>Desktop</option>
              <option value={834}>Tablet</option>
              <option value={390}>Mobile</option>
            </select>
            <button onClick={() => setPreview(false)}>Back to editing</button>
          </header>
          <PreviewFrame
            width={width}
            layout={draft.data}
            cms={draft.payload.bootstrap}
          />
        </>
      )}
      {history && (
        <aside
          className="visual-panel visual-revisions"
          role="dialog"
          aria-label="Earlier versions"
        >
          <header>
            <h2>Earlier versions</h2>
            <button onClick={() => setHistory(false)}>Close</button>
          </header>
          <p>
            Restore creates a draft. The website changes only after you publish.
          </p>
          {draft.payload.revisions.length === 0 && (
            <p>Save a draft to create your first version.</p>
          )}
          {draft.payload.revisions.map((r) => (
            <div key={r.id}>
              <strong>
                {r.action === "publish"
                  ? "Published version"
                  : r.action === "autosave"
                    ? "Automatic draft"
                    : r.action === "restore"
                      ? "Restored draft"
                      : "Saved draft"}
              </strong>
              <p>
                <time dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleString()}
                </time>{" "}
                · {r.createdByName}
              </p>
              <button
                disabled={busy || draft.saving}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Restore this earlier version as a draft? Your current unsaved changes will be replaced.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await draft.restore(r.id);
                    setHistory(false);
                  } catch (e) {
                    draft.setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore as draft
              </button>
            </div>
          ))}
        </aside>
      )}
      {review && (
        <aside
          className="visual-panel visual-revisions"
          role="dialog"
          aria-label="Review before publishing"
        >
          <header>
            <h2>Ready to publish?</h2>
            <button onClick={() => setReview(false)}>Close</button>
          </header>
          <p>
            Publishing updates the public page at{" "}
            <strong>{draft.payload.page.path}</strong>.
          </p>
          {!issues.length ? (
            <p className="visual-check-success">
              Your page passed the content checks.
            </p>
          ) : (
            <ul className="visual-review-list">
              {issues.map((issue, i) => (
                <li key={i} data-severity={issue.severity}>
                  <strong>
                    {issue.severity === "error"
                      ? "Needs fixing"
                      : "Please check"}
                  </strong>
                  <p>{issue.message}</p>
                  <small>Section: {issue.blockId}</small>
                </li>
              ))}
            </ul>
          )}
          <p>
            Check mobile before publishing, especially after layout changes.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              setWidth(390);
              setReview(false);
              void action("preview");
            }}
          >
            Preview on mobile
          </button>
          <button
            className="visual-primary"
            disabled={busy || issues.some((i) => i.severity === "error")}
            onClick={() => void action("publish")}
          >
            {busy ? "Publishing…" : "Publish changes"}
          </button>
        </aside>
      )}
    </div>
  );
}

function OpenRequestedSection() {
  const data = useEditorPuck((s) => s.appState.data);
  const selectorForId = useEditorPuck((s) => s.getSelectorForId);
  const dispatch = useEditorPuck((s) => s.dispatch);
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("section");
    if (!id) return;
    const selector = selectorForId(id);
    if (!selector) return;
    dispatch({
      type: "setUi",
      ui: { itemSelector: selector, rightSideBarVisible: true },
    });
    url.searchParams.delete("section");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [data, selectorForId, dispatch]);
  return null;
}

function EditorToolbar({
  draft,
  allowDesign,
  mode,
  setMode,
  busy,
  onSave,
  onPreview,
  onHistory,
  onReview,
}: {
  draft: Draft;
  allowDesign: boolean;
  mode: EditorMode;
  setMode: (m: EditorMode) => void;
  busy: boolean;
  onSave: () => void;
  onPreview: () => void;
  onHistory: () => void;
  onReview: () => void;
}) {
  const history = useEditorPuck((s) => s.history);
  const dispatch = useEditorPuck((s) => s.dispatch);
  const [library, setLibrary] = useState(false);
  const existing = new Set<string>();
  const walk = (blocks: VisualBlock[]) =>
    blocks.forEach((b) => {
      if (b.props.kind) existing.add(b.props.kind);
      walk(b.props.children ?? []);
    });
  walk(draft.data?.content ?? []);
  return (
    <>
      <header className="visual-toolbar">
        <a
          href="/admin/pages"
          onClick={(e) => {
            if (
              draft.dirty &&
              !window.confirm(
                "Leave this page? Unsaved changes can be recovered in this browser.",
              )
            )
              e.preventDefault();
          }}
        >
          ← Pages
        </a>
        <div className="visual-page-name">
          <strong>{draft.payload?.page.title}</strong>
          <small>{draft.payload?.page.path}</small>
        </div>
        {allowDesign && (
          <div className="visual-mode-toggle" aria-label="Editing mode">
            <button
              aria-pressed={mode === "content"}
              disabled={busy}
              onClick={() => setMode("content")}
            >
              Content
            </button>
            <button
              aria-pressed={mode === "design"}
              disabled={busy}
              onClick={() => setMode("design")}
            >
              Design
            </button>
          </div>
        )}
        <button
          disabled={!history.hasPast || busy}
          onClick={() => history.back()}
          title="Undo last edit"
        >
          Undo
        </button>
        <button
          disabled={!history.hasFuture || busy}
          onClick={() => history.forward()}
          title="Redo last edit"
        >
          Redo
        </button>
        {mode === "design" && (
          <button
            disabled={busy || !!draft.recovery}
            onClick={() => setLibrary(true)}
          >
            ＋ Add section
          </button>
        )}
        <span role="status" aria-live="polite" className="visual-status">
          {draft.saving
            ? "Saving…"
            : draft.dirty
              ? "Unsaved changes"
              : draft.status}
        </span>
        <button
          disabled={busy || draft.saving || !!draft.recovery}
          onClick={onSave}
        >
          Save Draft
        </button>
        <button disabled={busy || !!draft.recovery} onClick={onPreview}>
          Preview
        </button>
        {allowDesign && (
          <button
            onClick={() =>
              dispatch({
                type: "setUi",
                ui: (s) => ({
                  ...s,
                  viewports: {
                    ...s.viewports,
                    current: { width: 390, height: "auto" },
                  },
                }),
              })
            }
          >
            Mobile
          </button>
        )}
        <button onClick={onHistory}>Earlier versions</button>
        <a href={`/admin/pages/${draft.payload?.page.id}`}>Page settings</a>
        {draft.payload?.canPublish && (
          <button
            className="visual-primary"
            disabled={busy || !!draft.recovery}
            onClick={onReview}
          >
            Review &amp; publish
          </button>
        )}
      </header>
      {library && (
        <SectionLibrary
          existing={existing}
          onClose={() => setLibrary(false)}
          onAdd={(block) =>
            dispatch({
              type: "setData",
              recordHistory: true,
              data: (previous) => ({
                ...previous,
                content: [...previous.content, block] as Data["content"],
              }),
            })
          }
        />
      )}
    </>
  );
}
function BlockPosition({ disabled }: { disabled: boolean }) {
  const selected = useEditorPuck((s) => s.selectedItem);
  const data = useEditorPuck((s) => s.appState.data);
  const dispatch = useEditorPuck((s) => s.dispatch);
  const id = selected?.props.id;
  const find = (blocks: VisualBlock[]): VisualBlock[] | undefined => {
    if (blocks.some((b) => b.props.id === id)) return blocks;
    for (const b of blocks) {
      const result = find(b.props.children ?? []);
      if (result) return result;
    }
  };
  const siblings = find(data.content as VisualBlock[]);
  if (!siblings) return null;
  const index = siblings.findIndex((b) => b.props.id === id);
  const move = (direction: number) => {
    const reorder = (blocks: VisualBlock[]): VisualBlock[] => {
      const at = blocks.findIndex((b) => b.props.id === id);
      if (at >= 0) {
        const next = [...blocks];
        [next[at], next[at + direction]] = [next[at + direction], next[at]];
        return next;
      }
      return blocks.map((b) =>
        b.props.children
          ? { ...b, props: { ...b.props, children: reorder(b.props.children) } }
          : b,
      );
    };
    dispatch({
      type: "setData",
      recordHistory: true,
      data: (previous) => ({
        ...previous,
        content: reorder(previous.content as VisualBlock[]) as Data["content"],
      }),
    });
    dispatch({ type: "setUi", ui: { itemSelector: null } });
  };
  return (
    <div className="visual-block-position">
      <span>
        Position {index + 1} of {siblings.length}
      </span>
      <button disabled={disabled || index === 0} onClick={() => move(-1)}>
        Move up
      </button>
      <button
        disabled={disabled || index === siblings.length - 1}
        onClick={() => move(1)}
      >
        Move down
      </button>
    </div>
  );
}
const sharedCollections: Record<string, { name: string; path: string }> = {
  Stats: { name: "statistics", path: "/admin/collections/metrics" },
  Testimonials: {
    name: "testimonials",
    path: "/admin/collections/testimonials",
  },
  Faq: { name: "FAQs", path: "/admin/collections/faqs" },
  ResourceLibrary: { name: "published resources", path: "/admin/posts" },
};
const heroKinds = ["Hero", "PageHero", "PricingHero", "PartnershipHero"];
function SharedContentNotice() {
  const selectedItem = useEditorPuck((s) => s.selectedItem);
  // Page-level panel (nothing selected): explain that the footer is global.
  if (!selectedItem)
    return (
      <div className="visual-selection-help">
        <p>The footer uses the original site design and links across all pages.</p>
      </div>
    );
  const kind = typeof selectedItem.props.kind === "string" ? selectedItem.props.kind : "";
  const entry = sharedCollections[kind];
  const isHero = heroKinds.includes(kind);
  if (!entry && !isHero) return null;
  return (
    <div className="visual-selection-help">
      {entry && (
        <>
          <strong>Used on multiple pages</strong>
          <p>
            The {entry.name} come from a shared collection. Changes there affect
            every page using them.
          </p>
          <a href={entry.path} target="_blank" rel="noopener noreferrer">
            Edit shared {entry.name} ↗
          </a>
        </>
      )}
      {isHero && (
        <p>
          Navigation is shared across the site.{" "}
          <a href="/admin/menus" target="_blank" rel="noopener noreferrer">
            Edit navigation ↗
          </a>
        </p>
      )}
    </div>
  );
}
function PreviewFrame({
  width,
  layout,
  cms,
}: {
  width: number;
  layout: VisualLayout;
  cms: CmsBootstrap;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  return (
    <div className="visual-preview-stage">
      <iframe
        title="Private draft preview"
        srcDoc={
          '<!doctype html><html><head></head><body><div id="preview"></div></body></html>'
        }
        onLoad={(e) => {
          const doc = e.currentTarget.contentDocument;
          if (!doc) return;
          doc.documentElement.className = document.documentElement.className;
          for (const node of document.head.querySelectorAll(
            'style,link[rel="stylesheet"]',
          ))
            doc.head.appendChild(node.cloneNode(true));
          setTarget(doc.getElementById("preview"));
        }}
        style={{
          width,
          maxWidth: "100%",
          height: "calc(100vh - 100px)",
          border: 0,
          background: "white",
        }}
      />
      {target && createPortal(<VisualPage layout={layout} cms={cms} />, target)}
    </div>
  );
}
function CanvasDocument({
  doc,
  children,
}: {
  doc?: Document;
  children: ReactNode;
}) {
  useEffect(() => {
    doc?.documentElement.setAttribute(
      "class",
      window.document.documentElement.className,
    );
  }, [doc]);
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as Element;
        if (target.closest('a,button[type="submit"]')) e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
