import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { RuntimeScripts } from "../components/layout/RuntimeScripts";
import { withoutHiddenPageLinks } from "../components/layout/SiteFooter";
import { ConsentEmbed, ConsentHtml } from "../components/privacy/ConsentEmbed";

afterEach(() => { cleanup(); document.body.innerHTML = ""; });

test("runtime scripts load without rendering cookie-consent controls", () => {
  render(<RuntimeScripts gaId="G-TEST1" gtmId="GTM-TEST1" headerScripts="<script>window.headerRan=true</script>" footerScripts="" headerCategory="marketing" footerCategory="marketing" snippets={[{ location: "footer", language: "js", code: "window.marketingRan=true", consentCategory: "marketing" }]} />);
  assert.ok(document.querySelector('script[src*="gtag/js"]'));
  assert.ok(document.body.innerHTML.includes("GTM-TEST1"));
  assert.ok(document.body.innerHTML.includes("window.marketingRan"));
  assert.ok(document.body.innerHTML.includes("window.headerRan"));
  assert.equal(screen.queryByRole("button", { name: /cookie|accept|reject|customize/i }), null);
});

test("third-party embeds render without a cookie preference gate", () => {
  render(<><ConsentEmbed src="https://www.youtube-nocookie.com/embed/abcdefghijk" title="Video" /><ConsentHtml id="custom" html={'<p>Before</p><iframe src="https://example.com/embed"></iframe><p>After</p>'} /></>);
  assert.equal(document.querySelectorAll("iframe").length, 2);
  assert.equal(screen.queryByRole("button", { name: /functional cookies/i }), null);
});

test("footer omits FAQ, Services and Features from CMS page links", () => {
  const links = withoutHiddenPageLinks([
    { label: "Home", href: "/" },
    { label: "Services", href: "/#services" },
    { label: "Features", href: "/#features" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contact Us", href: "/contact" },
  ]);
  assert.deepEqual(links.map((item) => item.label), ["Home", "Contact Us"]);
});
