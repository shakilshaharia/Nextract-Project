import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { makeConfig } from "../components/visual/config";
import { ImageProperties, MediaField } from "../components/visual/MediaField";
import { LinkField, StylePresets } from "../components/visual/Controls";
import { SectionLibrary } from "../components/visual/SectionLibrary";
import {
  useVisualDraft,
  type EditorPayload,
} from "../components/visual/useVisualDraft";
import {
  reviewVisual,
  visualLayoutSchema,
  type VisualLayout,
} from "@workspace/cms-content";
import Editor from "../components/visual/Editor";
import { Puck, createUsePuck, type Data } from "@puckeditor/core";
import { SectionMediaField } from "../components/visual/SectionMediaField";
import {
  SectionMedia,
  sectionMedia,
  videoEmbed,
} from "../components/ui/SectionMedia";
import { website, conform } from "../components/visual/website";
import { renderToStaticMarkup } from "react-dom/server";
import {
  legacySectionInfo,
  visualSectionInfo,
} from "../../cms-admin/src/pages/section-catalog";

test("section list uses specific names, media thumbnails, and shared collection destinations", () => {
  const workflow = legacySectionInfo({
    id: "w",
    type: "managed",
    visible: true,
    key: "workflow",
    label: "Managed design section",
    contentJson: "{}",
  });
  assert.equal(workflow.name, "Document workflow");
  assert.ok(workflow.image);
  assert.ok(!workflow.description.includes("JSON"));
  const custom = visualSectionInfo({
    type: "Website",
    props: {
      id: "s",
      kind: "Solutions",
      content: {
        records: {
          image: { src: "/uploads/custom-photo.webp", alt: "Custom" },
        },
      },
    },
  });
  assert.equal(custom.name, "Solutions");
  assert.equal(custom.image, "/uploads/custom-photo.webp");
  assert.equal(
    visualSectionInfo({ type: "Website", props: { id: "faq", kind: "Faq" } })
      .shared?.href,
    "/collections/faqs",
  );
  assert.equal(
    legacySectionInfo({
      id: "t",
      type: "trust",
      visible: true,
      headline: "Clients",
    }).shared?.href,
    "/collections/logos",
  );
});

test("Edit content deep links open the requested section's controls", async () => {
  window.history.replaceState({}, "", "/visual-editor/page-1?section=h");
  globalThis.fetch = () => json(payload());
  render(<Editor id="page-1" />);
  await waitFor(() => assert.equal(window.location.search, ""));
  const inputs = await screen.findAllByLabelText("Text");
  assert.ok(
    inputs.every((input) => (input as HTMLInputElement).value === "Original"),
  );
  window.history.replaceState({}, "", "/");
});

test("existing homepage drafts gain media defaults without losing their edited copy", async () => {
  const config = makeConfig(null, "content");
  const hero = conform(website.Hero.defaults, {
    titleLead: "Client heading",
  }) as typeof website.Hero.defaults;
  assert.equal(hero.titleLead, "Client heading");
  assert.deepEqual(hero.media, sectionMedia);
  const resolve = config.components.Website.resolveFields!;
  for (const kind of [
    "Hero",
    "Workflow",
    "Solutions",
    "Integrations",
    "AiAnswers",
    "DemoCta",
  ]) {
    const fields = await resolve(
      { props: { id: kind, kind, content: {} } },
      {} as never,
    );
    const serialized = JSON.stringify(fields);
    assert.match(serialized, /Image or video|Video|Image|"panels"|"steps"/);
    if (kind === "Hero")
      assert.equal(
        (fields.content as { objectFields: Record<string, { type: string }> })
          .objectFields.media.type,
        "custom",
      );
  }
});

test("homepage media controls offer original, image and video with the media library", () => {
  let changed = sectionMedia;
  const view = render(
    <SectionMediaField
      value={sectionMedia}
      onChange={(v) => {
        changed = v;
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Section visual"), {
    target: { value: "image" },
  });
  view.rerender(
    <SectionMediaField
      value={changed}
      onChange={(v) => {
        changed = v;
      }}
    />,
  );
  assert.ok(screen.getByText("Choose image"));
  assert.ok(screen.getByLabelText("Image description"));
  fireEvent.change(screen.getByLabelText("Section visual"), {
    target: { value: "video" },
  });
  view.rerender(
    <SectionMediaField
      value={changed}
      onChange={(v) => {
        changed = v;
      }}
    />,
  );
  assert.ok(screen.getByText("Choose video"));
  fireEvent.change(screen.getByLabelText("Video description"), {
    target: { value: "Product walkthrough" },
  });
  assert.equal(changed.description, "Product walkthrough");
});

test("section media renders replacements and restores the original design", () => {
  const original = renderToStaticMarkup(
    <SectionMedia>
      <span>Original animation</span>
    </SectionMedia>,
  );
  assert.match(original, /Original animation/);
  const image = renderToStaticMarkup(
    <SectionMedia
      value={{
        ...sectionMedia,
        mode: "image",
        image: { src: "/replacement.png", alt: "Replacement" },
      }}
    >
      <span>Original</span>
    </SectionMedia>,
  );
  assert.match(image, /alt="Replacement"/);
  assert.ok(!image.includes("Original"));
  const video = renderToStaticMarkup(
    <SectionMedia
      value={{ ...sectionMedia, mode: "video", video: "/clip.mp4" }}
    >
      Original
    </SectionMedia>,
  );
  assert.match(video, /<video/);
  assert.match(video, /src="\/clip.mp4"/);
  assert.equal(
    videoEmbed("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbed("https://vimeo.com/1234567"),
    "https://player.vimeo.com/video/1234567",
  );
  assert.equal(
    videoEmbed("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
    "",
  );
  assert.ok(
    reviewVisual({
      root: { props: {} },
      content: [
        {
          type: "Website",
          props: {
            id: "hero",
            kind: "Hero",
            content: { media: { ...sectionMedia, mode: "image" } },
          },
        },
      ],
    }).some((i) => i.severity === "error"),
  );
});

const originalFetch = globalThis.fetch;
const useHistoryHarness = createUsePuck();
function HistoryHarness() {
  const dispatch = useHistoryHarness((s) => s.dispatch),
    history = useHistoryHarness((s) => s.history),
    data = useHistoryHarness((s) => s.appState.data);
  return (
    <>
      <button
        onClick={() =>
          dispatch({
            type: "setData",
            recordHistory: true,
            data: (previous) => ({
              ...previous,
              content: [
                ...previous.content,
                {
                  type: "Paragraph",
                  props: { id: "new-block", text: "Added" },
                },
              ],
            }),
          })
        }
      >
        Test insertion
      </button>
      <button disabled={!history.hasPast} onClick={() => history.back()}>
        Test undo
      </button>
      <button disabled={!history.hasFuture} onClick={() => history.forward()}>
        Test redo
      </button>
      <output data-testid="history-data">{JSON.stringify(data)}</output>
    </>
  );
}
test("real Puck changes emit valid metadata and undo/redo restore inserted content", async () => {
  render(
    <Puck
      config={makeConfig(null, "design", true)}
      data={d() as unknown as Data}
      iframe={{ enabled: false }}
      overrides={{ header: () => <HistoryHarness /> }}
    />,
  );
  fireEvent.click(screen.getByText("Test insertion"));
  await waitFor(() =>
    assert.equal(
      (screen.getByText("Test undo") as HTMLButtonElement).disabled,
      false,
    ),
  );
  const inserted = JSON.parse(screen.getByTestId("history-data").textContent!);
  assert.ok(visualLayoutSchema.safeParse(inserted).success);
  assert.equal(inserted.content.length, 2);
  fireEvent.click(screen.getByText("Test undo"));
  await waitFor(() =>
    assert.equal(
      JSON.parse(screen.getByTestId("history-data").textContent!).content
        .length,
      1,
    ),
  );
  fireEvent.click(screen.getByText("Test redo"));
  await waitFor(() =>
    assert.equal(
      JSON.parse(screen.getByTestId("history-data").textContent!).content
        .length,
      2,
    ),
  );
});
const d = (): VisualLayout => ({
  root: { props: {} },
  content: [{ type: "Heading", props: { id: "h", text: "Original" } }],
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  localStorage.clear();
});
const json = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
function payload(layout = d()): EditorPayload {
  return {
    editorId: "user-1",
    page: {
      id: "page-1",
      title: "Example",
      path: "/example",
      slug: "example",
      status: "PUBLISHED",
    },
    layout,
    version: 4,
    bootstrap: {
      settings: {
        siteName: "Nextract",
        copyright: "",
        logo: { url: "", alt: "" },
        footerLogo: { url: "", alt: "" },
        favicon: "",
        contactEmail: "",
        phone: "",
        address: "",
        social: {},
        demo: { ctaLabel: "Demo" },
        defaultSeoTitle: "",
        defaultMetaDescription: "",
        defaultOgImage: "",
        googleAnalyticsId: "",
        googleTagManagerId: "",
        headerScripts: "",
        footerScripts: "",
        robotsDisallow: [],
      },
      seo: {
        titleSeparator: "|",
        defaultRobots: [],
        maxSnippet: -1,
        maxImagePreview: "large",
        maxVideoPreview: -1,
        orgType: "Organization",
        orgName: "",
        orgLogo: "",
        orgPhone: "",
        orgEmail: "",
        orgStreet: "",
        orgCity: "",
        orgRegion: "",
        orgPostalCode: "",
        orgCountry: "",
        orgLat: "",
        orgLng: "",
        orgPriceRange: "",
        twitterCard: "summary_large_image",
        twitterSite: "",
        facebookAppId: "",
        googleVerify: "",
        bingVerify: "",
        yandexVerify: "",
        pinterestVerify: "",
        baiduVerify: "",
        breadcrumbsEnabled: true,
      },
      menus: {},
      collections: {
        metrics: [],
        testimonials: [],
        faqs: [],
        logos: [],
        products: [],
      },
      page: {
        slug: "example",
        title: "Example",
        excerpt: "",
        sections: [],
        seo: { seoTitle: "", metaDescription: "" },
      },
    },
    revisions: [],
    canPublish: true,
  };
}
test("content mode exposes copy and media while design mode exposes styling", () => {
  const content = makeConfig(null, "content"),
    design = makeConfig(null, "design", true);
  assert.ok(content.components.Heading.fields?.text);
  assert.ok(content.components.Image.fields?.image);
  assert.ok(!content.components.Heading.fields?.style);
  assert.ok(design.components.Heading.fields?.style);
  assert.deepEqual(
    content.categories?.basic.components,
    design.categories?.basic.components,
  );
  assert.ok(design.categories?.basic.components?.includes("Heading"));
});
test("full editor opens in content mode and switches to the branded section library", async () => {
  globalThis.fetch = (_url, init) =>
    init?.method === "PATCH"
      ? json({ version: 5, layout: d() })
      : json(payload());
  render(<Editor id="page-1" allowDesign />);
  await screen.findByRole("button", { name: "Content" });
  assert.equal(
    screen
      .getByRole("button", { name: "Content" })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Design" }));
  fireEvent.click(await screen.findByRole("button", { name: /Add section/ }));
  assert.ok(screen.getByRole("dialog", { name: "Add a branded section" }));
});
test("disabled design feature hides design entry points and keeps normal draft actions", async () => {
  globalThis.fetch = () => json(payload());
  // Explicitly the disabled path, independent of the current feature flag.
  render(<Editor id="page-1" allowDesign={false} />);
  await screen.findByRole("button", { name: "Save Draft" });
  assert.equal(screen.queryByRole("button", { name: "Design" }), null);
  assert.equal(screen.queryByRole("button", { name: /Add section/ }), null);
  assert.equal(screen.queryByText(/Switch to Design/), null);
  assert.equal(
    screen.queryByRole("button", { name: /Switch to .* viewport/ }),
    null,
  );
  assert.equal(screen.queryByRole("button", { name: /Zoom viewport/ }), null);
  assert.equal(screen.queryByRole("button", { name: /^Mobile$/ }), null);
  assert.ok(screen.getByRole("button", { name: "Preview" }));
  assert.ok(screen.getByRole("button", { name: "Review & publish" }));
  const config = makeConfig(null, "design", false);
  for (const component of Object.values(config.components)) {
    assert.equal(component.fields?.style, undefined);
    assert.equal(component.fields?.tablet, undefined);
    assert.equal(component.fields?.mobile, undefined);
  }
  assert.equal(config.components.Video.fields?.autoplay, undefined);
  assert.equal(config.components.Gallery.fields?.items.type, "custom");
});

test("editor re-renders keep panels mounted so typing never loses focus", async () => {
  globalThis.fetch = () => json(payload());
  render(<Editor id="page-1" allowDesign />);
  const before = await screen.findByRole("button", { name: "Save Draft" });
  // Any Editor state change re-renders the Puck overrides. Before the fix they
  // were inline functions, so this remounted the toolbar/fields/canvas and
  // dropped focus mid-typing.
  fireEvent.click(screen.getByRole("button", { name: "Earlier versions" }));
  await screen.findByRole("dialog", { name: "Earlier versions" });
  const after = screen.getByRole("button", { name: "Save Draft" });
  assert.equal(after === before, true, "toolbar was remounted on re-render");
});

test("content-only nested items preserve structure while their text and media remain editable", async () => {
  const config = makeConfig(null, "content");
  const fields = await config.components.Website.resolveFields!(
    { props: { id: "workflow", kind: "Workflow", content: {} } },
    {} as never,
  );
  const panels = (
    fields.content as {
      objectFields: Record<string, { render: (p: unknown) => React.ReactNode }>;
    }
  ).objectFields.panels;
  let changed: unknown;
  render(
    <>
      {panels.render({
        value: website.Workflow.defaults.panels,
        onChange: (v: unknown) => {
          changed = v;
        },
      })}
    </>,
  );
  assert.equal(
    screen.queryByRole("button", { name: /^(Add item|Remove item.*|Delete)$/ }),
    null,
  );
  const headings = screen.getAllByLabelText("Main heading");
  fireEvent.change(headings[0], {
    target: { value: "Edited workflow heading" },
  });
  const next = changed as Record<string, unknown>[];
  assert.equal(
    next.length,
    (website.Workflow.defaults.panels as unknown[]).length,
  );
  assert.equal(next[0].title, "Edited workflow heading");
  assert.equal(next[0].animation, "/animations/capture.json");
  assert.ok(screen.getAllByLabelText("Section visual").length > 0);
});

test("link picker offers named pages, email and phone without manual URL prefixes", async () => {
  globalThis.fetch = () =>
    json({ items: [{ id: "p", title: "About us", path: "/about" }] });
  const changes: string[] = [];
  const view = render(
    <LinkField value="/about" onChange={(v) => changes.push(v)} />,
  );
  await screen.findByText("About us");
  fireEvent.change(screen.getByLabelText("Button destination"), {
    target: { value: "email" },
  });
  view.rerender(
    <LinkField value="mailto:" onChange={(v) => changes.push(v)} />,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "hello@example.com" },
  });
  assert.equal(changes.at(-1), "mailto:hello@example.com");
});
test("media picker browses real API shape and selection copies library alt text", async () => {
  globalThis.fetch = (url) => {
    assert.ok(String(url).includes("pageSize=60"));
    return json({
      items: [
        {
          id: "a",
          url: "/photo.png",
          alt: "Team in the office",
          filename: "team.png",
          kind: "image",
        },
      ],
      pages: 1,
    });
  };
  let image: unknown;
  render(
    <ImageProperties
      value={{ src: "", alt: "", focalX: 50, focalY: 50, ratio: "original" }}
      onChange={(v) => {
        image = v;
      }}
    />,
  );
  fireEvent.click(screen.getByText("Choose image"));
  fireEvent.click(await screen.findByText("team.png"));
  fireEvent.click(screen.getByText("Use this image"));
  assert.deepEqual(image, {
    src: "/photo.png",
    alt: "Team in the office",
    focalX: 50,
    focalY: 50,
    ratio: "original",
  });
});
test("media addresses are validated and apply only on confirmation", async () => {
  globalThis.fetch = () => json({ items: [], pages: 1 });
  const changes: string[] = [];
  render(
    <MediaField value="/original.png" onChange={(v) => changes.push(v)} />,
  );
  fireEvent.click(screen.getByText("Replace image"));
  fireEvent.click(screen.getByText("Image address"));
  fireEvent.change(screen.getByLabelText("Image URL"), {
    target: { value: "/canceled.png" },
  });
  fireEvent.click(screen.getByText("Close"));
  assert.deepEqual(changes, []);
  fireEvent.click(screen.getByText("Replace image"));
  fireEvent.click(screen.getByText("Image address"));
  assert.equal(
    (screen.getByLabelText("Image URL") as HTMLInputElement).value,
    "/original.png",
  );
  fireEvent.change(screen.getByLabelText("Image URL"), {
    target: { value: "javascript:alert(1)" },
  });
  fireEvent.click(screen.getByText("Use this address"));
  assert.ok(screen.getByRole("alert"));
  assert.deepEqual(changes, []);
  fireEvent.change(screen.getByLabelText("Image URL"), {
    target: { value: " /confirmed.png " },
  });
  fireEvent.click(screen.getByText("Use this address"));
  assert.deepEqual(changes, ["/confirmed.png"]);
});

test("image shape and focus controls update structured crop metadata", () => {
  const changes: unknown[] = [];
  render(
    <ImageProperties
      value={{
        src: "/photo.png",
        alt: "Photo",
        focalX: 50,
        focalY: 50,
        ratio: "original",
      }}
      onChange={(v) => changes.push(v)}
    />,
  );
  fireEvent.change(screen.getByLabelText("Image shape"), {
    target: { value: "1/1" },
  });
  assert.equal((changes.at(-1) as { ratio: string }).ratio, "1/1");
  fireEvent.change(screen.getByLabelText("Horizontal focus"), {
    target: { value: 25 },
  });
  assert.equal((changes.at(-1) as { focalX: number }).focalX, 25);
});
test("client spacing and typography presets set supported style values", () => {
  let value: unknown;
  render(
    <StylePresets
      value={{}}
      onChange={(v) => {
        value = v;
      }}
      layout
    />,
  );
  fireEvent.change(screen.getByLabelText("Spacing"), { target: { value: 32 } });
  assert.deepEqual(value, { padding: 32 });
  fireEvent.click(screen.getByRole("button", { name: "3 columns" }));
  assert.deepEqual(value, { columns: 3 });
});
test("section library searches, adds valid branded sections, and protects existing shared sections", () => {
  let block: unknown;
  render(
    <SectionLibrary
      existing={new Set(["Faq"])}
      onAdd={(b) => {
        block = b;
      }}
      onClose={() => {}}
    />,
  );
  assert.ok(
    (
      screen.getByRole("button", {
        name: /Frequently asked questions/,
      }) as HTMLButtonElement
    ).disabled,
  );
  fireEvent.change(screen.getByLabelText("Search sections"), {
    target: { value: "Text beside" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Text beside image/ }));
  assert.ok(block);
  const layout = { root: { props: {} }, content: [block] };
  assert.ok(visualLayoutSchema.safeParse(layout).success);
  assert.equal(
    reviewVisual(layout as VisualLayout).filter((i) => i.severity === "error")
      .length,
    0,
  );
});
test("autosave debounces edits, persists a draft, and never calls publish", async () => {
  const calls: string[] = [];
  globalThis.fetch = (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return init?.method === "PATCH"
      ? json({ version: 5, layout: JSON.parse(init.body as string).layout })
      : json(payload());
  };
  const { result } = renderHook(() => useVisualDraft("page-1"));
  await waitFor(() => assert.ok(result.current.data));
  act(() => {
    const next = d();
    next.content[0].props.text = "Changed";
    result.current.change(next);
  });
  assert.equal(result.current.dirty, true);
  await waitFor(() => assert.equal(result.current.dirty, false), {
    timeout: 4000,
  });
  assert.equal(calls.filter((c) => c.startsWith("PATCH")).length, 1);
  assert.ok(calls.every((c) => !c.includes("/publish")));
  assert.equal(result.current.status, "All changes saved");
});
test("browser recovery is user/page scoped, explicit, and keeps the server version", async () => {
  const recovered = d();
  recovered.content[0].props.text = "Recovered";
  localStorage.setItem(
    "nextract-visual:user-1:page-1",
    JSON.stringify({
      layout: recovered,
      version: 4,
      at: new Date().toISOString(),
    }),
  );
  globalThis.fetch = () => json(payload());
  const { result } = renderHook(() => useVisualDraft("page-1"));
  await waitFor(() => assert.ok(result.current.recovery));
  assert.equal(result.current.data?.content[0].props.text, "Original");
  act(() => result.current.recover());
  assert.equal(result.current.data?.content[0].props.text, "Recovered");
  assert.equal(result.current.dirty, true);
});
test("failed saves retain local changes and stop automatic retries until requested", async () => {
  let writes = 0;
  globalThis.fetch = (_url, init) => {
    if (init?.method === "PATCH") {
      writes++;
      return json({ error: { message: "Changed in another editor" } }, 409);
    }
    return json(payload());
  };
  const { result } = renderHook(() => useVisualDraft("page-1"));
  await waitFor(() => assert.ok(result.current.data));
  act(() => {
    const next = d();
    next.content[0].props.text = "Keep me";
    result.current.change(next);
  });
  await act(async () => {
    await assert.rejects(result.current.save());
  });
  assert.equal(result.current.paused, true);
  assert.equal(result.current.dirty, true);
  assert.equal(writes, 1);
  assert.ok(
    localStorage.getItem("nextract-visual:user-1:page-1")?.includes("Keep me"),
  );
});
