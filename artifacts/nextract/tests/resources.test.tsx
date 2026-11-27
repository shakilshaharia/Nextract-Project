import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { DetailsCard, MetaRow, PostBody, PostFaqJsonLd } from "../components/post/PostLayout";
import { resourceToPost } from "../lib/cms-posts";
import type { CmsResource } from "../lib/cms";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const resource: CmsResource = {
  type: "BLOG",
  segment: "resources",
  slug: "rich-resource",
  path: "/resources/rich-resource",
  title: "Rich resource",
  summary: "Resource summary",
  cover: null,
  publishedAt: "2026-11-23T00:00:00.000Z",
  event: null,
  useCase: null,
  author: "Nicolas Ardila",
  readingMinutes: 4,
  html: '<p>Read the <a href="/contact">full guide</a>.</p><img src="/uploads/diagram.png" alt="Invoice workflow"><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled></label><div><p>Approved</p></div></li></ul><div class="tableWrapper"><table><thead><tr><th>Stage</th><th>Owner</th></tr></thead><tbody><tr><td>Review</td><td>Finance</td></tr></tbody></table></div>',
  faqs: [],
  seo: { seoTitle: "", metaDescription: "" },
};

test("CMS resource markup preserves inline images and hyperlinks", () => {
  const post = resourceToPost(resource);
  assert.deepEqual(post.body, [{ kind: "richText", html: resource.html }]);

  render(<PostBody blocks={post.body} />);

  assert.equal(screen.getByRole("link", { name: "full guide" }).getAttribute("href"), "/contact");
  assert.equal(screen.getByRole("img", { name: "Invoice workflow" }).getAttribute("src"), "/uploads/diagram.png");
  const checkbox = screen.getByRole("checkbox");
  assert.equal(checkbox.hasAttribute("checked"), true);
  assert.equal(checkbox.hasAttribute("disabled"), true);
  assert.equal(screen.getByRole("table").tagName, "TABLE");
  assert.equal(screen.getByRole("columnheader", { name: "Stage" }).textContent, "Stage");
  assert.equal(screen.getByRole("cell", { name: "Finance" }).textContent, "Finance");
});

test("blog article details omit the author role", () => {
  const post = resourceToPost(resource);
  render(<><MetaRow post={post} /><DetailsCard post={post} /></>);

  assert.equal(screen.queryByText("Role"), null);
  assert.equal(screen.getAllByText("Nicolas Ardila").length >= 1, true);
});

test("article FAQ structured data preserves angle brackets as JSON text", () => {
  const question = "How should 1 < 2 be displayed?";
  const post = resourceToPost({ ...resource, faqs: [{ question, answer: "Use the < operator." }] });
  render(<PostFaqJsonLd faqs={post.faqs ?? []} />);

  const json = document.querySelector('script[type="application/ld+json"]')?.textContent;
  assert.ok(json);
  assert.doesNotMatch(json, /</);
  assert.equal(JSON.parse(json).mainEntity[0].name, question);
});
