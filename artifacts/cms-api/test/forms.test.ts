import assert from "node:assert/strict";
import { test } from "node:test";
import { formFieldsSchema } from "@workspace/cms-content";
import { formRedirectSchema } from "../src/lib/forms.ts";

test("custom form redirects accept local and HTTPS destinations only with safe URL syntax", () => {
  assert.equal(formRedirectSchema.parse(" /thank-you "), "/thank-you");
  assert.equal(formRedirectSchema.parse("https://example.invalid/thank-you"), "https://example.invalid/thank-you");
  assert.equal(formRedirectSchema.safeParse("//example.invalid").success, false);
  assert.equal(formRedirectSchema.safeParse("ftp://example.invalid").success, false);
});

test("formFieldsSchema accepts a valid field set and applies defaults", () => {
  const parsed = formFieldsSchema.parse([
    { id: "f1", type: "text", name: "full_name", label: "Full name", required: true },
    { id: "f2", type: "email", name: "email", label: "Email", required: true },
    { id: "f3", type: "select", name: "topic", label: "Topic", options: [{ label: "A", value: "a" }] },
    { id: "f4", type: "consent", name: "consent", label: "I agree", required: true },
  ]);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].width, "full"); // default applied
  assert.equal(parsed[2].options[0].value, "a");
});

test("formFieldsSchema rejects an invalid field name", () => {
  assert.throws(() => formFieldsSchema.parse([{ id: "f1", type: "text", name: "1 bad name" }]));
});

test("formFieldsSchema rejects an unknown field type", () => {
  assert.throws(() => formFieldsSchema.parse([{ id: "f1", type: "slider", name: "ok" }]));
});
