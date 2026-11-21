import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reviewVisual,
  visualLayoutSchema,
  type VisualLayout,
} from "@workspace/cms-content";
import { validateVisual } from "../src/lib/visual.ts";

const layout = (): VisualLayout => ({
  root: { props: {} },
  content: [
    {
      type: "Heading",
      props: { id: "heading", text: "Sales & support < 24 hours" },
    },
  ],
});
test('Puck onChange empty zones metadata is accepted without permitting legacy executable zones',()=>{
  const data={...layout(),zones:{}};assert.deepEqual(validateVisual(data),data);
  assert.throws(()=>validateVisual({...data,zones:{legacy:[{type:'Script',props:{id:'x'}}]}}));
});
test("plain text retains punctuation and rich text is sanitized idempotently", () => {
  const input = layout();
  input.content.push({
    type: "RichText",
    props: {
      id: "rich",
      text: '<p>Hello <strong>world</strong><script>alert(1)</script><img src="/image.png" onerror="bad()"></p>',
    },
  });
  const first = validateVisual(input);
  assert.equal(first.content[0].props.text, input.content[0].props.text);
  assert.doesNotMatch(first.content[1].props.text!, /script|onerror/);
  assert.deepEqual(validateVisual(first), first);
});
test("unknown components, executable properties, and unsafe URLs are rejected", () => {
  for (const data of [
    { ...layout(), content: [{ type: "Script", props: { id: "x" } }] },
    {
      ...layout(),
      content: [
        { type: "Image", props: { id: "x", src: "javascript:alert(1)" } },
      ],
    },
    {
      ...layout(),
      content: [{ type: "Heading", props: { id: "x", onClick: "bad()" } }],
    },
    {
      ...layout(),
      content: [
        {
          type: "Website",
          props: {
            id: "x",
            kind: "Hero",
            content: { cta: { href: "data:text/html,bad" } },
          },
        },
      ],
    },
  ])
    assert.throws(() => validateVisual(data));
});
test("drafts can be incomplete, but publish review identifies missing media and button destinations", () => {
  const d = layout();
  d.content.push(
    { type: "Button", props: { id: "button", text: "Contact", href: "#" } },
    {
      type: "Image",
      props: {
        id: "image",
        image: { src: "", alt: "", ratio: "1/1", focalX: 50, focalY: 50 },
      },
    },
  );
  assert.ok(visualLayoutSchema.safeParse(d).success);
  assert.equal(reviewVisual(d).filter((i) => i.severity === "error").length, 2);
});
test("missing alt text is a warning rather than a publication blocker", () => {
  const d = layout();
  d.content.push({
    type: "Image",
    props: {
      id: "image",
      image: {
        src: "/uploads/example.png",
        alt: "",
        ratio: "4/3",
        focalX: 20,
        focalY: 70,
      },
    },
  });
  const issues = reviewVisual(validateVisual(d));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, "warning");
});
test("nested blocks require unique ids and bounded depth", () => {
  const d = layout();
  d.content.push({
    type: "Container",
    props: { id: "container", children: [d.content[0]] },
  });
  assert.throws(() => validateVisual(d));
  let child = layout().content[0];
  for (let i = 0; i < 40; i++)
    child = {
      type: "Container",
      props: { id: `container-${i}`, children: [child] },
    };
  assert.throws(() => validateVisual({ ...layout(), content: [child] }));
});
test("responsive layout and crop metadata survive validation and reject arbitrary CSS", () => {
  const d = layout();
  d.content.push({
    type: "Columns",
    props: {
      id: "columns",
      style: { columns: 3, padding: 32 },
      mobile: { columns: 1, padding: 16 },
      children: [
        {
          type: "Image",
          props: {
            id: "photo",
            image: {
              src: "/image.png",
              alt: "Example",
              ratio: "1/1",
              focalX: 25,
              focalY: 80,
            },
          },
        },
      ],
    },
  });
  assert.deepEqual(validateVisual(d), d);
  assert.throws(() =>
    validateVisual({
      ...d,
      content: [
        {
          type: "Heading",
          props: { id: "x", style: { background: "url(javascript:bad)" } },
        },
      ],
    }),
  );
});
test("link checks accept page, web, email and phone destinations and reject malformed links", () => {
  for (const href of [
    "/about",
    "https://example.com/contact",
    "mailto:hello@example.com",
    "tel:+15551234567",
  ])
    assert.doesNotThrow(() =>
      validateVisual({
        ...layout(),
        content: [
          { type: "Button", props: { id: "b", text: "Contact", href } },
        ],
      }),
    );
  for (const href of [
    "https://",
    "//evil.test",
    "mailto:",
    "tel:abc",
    "javascript:alert(1)",
    "https://user:password@example.com",
  ])
    assert.throws(() =>
      validateVisual({
        ...layout(),
        content: [
          { type: "Button", props: { id: "b", text: "Contact", href } },
        ],
      }),
    );
});
