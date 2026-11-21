import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseImportFiles } from '../src/lib/portability.ts';

const file = (name: string, contents: string) => ({ originalname: name, buffer: Buffer.from(contents) });

test('Markdown import keeps metadata and strips executable HTML', () => {
  const result = parseImportFiles([file('draft.md', '---\ntitle: Sample article\nslug: sample-article\ncategories: [news]\n---\n# Sample article\n\nHello **world**.\n<script>alert(1)</script>')]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.candidates[0].kind, 'post');
  assert.deepEqual(result.candidates[0].data.categorySlugs, ['news']);
  assert.match(String(result.candidates[0].data.contentHtml), /<strong>world<\/strong>/);
  assert.doesNotMatch(String(result.candidates[0].data.contentHtml), /<script>/);
});

test('WordPress WXR imports posts, pages and attachment references', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"><channel>
    <item><title>WP story</title><wp:post_type>post</wp:post_type><wp:post_name>wp-story</wp:post_name><content:encoded><![CDATA[<p>Story body</p>]]></content:encoded><category domain="category" nicename="news">News</category><wp:postmeta><wp:meta_key>_thumbnail_id</wp:meta_key><wp:meta_value>47</wp:meta_value></wp:postmeta></item>
    <item><title>WP page</title><wp:post_type>page</wp:post_type><wp:post_name>wp-page</wp:post_name><content:encoded><![CDATA[<p>Page body</p>]]></content:encoded></item>
    <item><title>Cover</title><wp:post_type>attachment</wp:post_type><wp:post_id>47</wp:post_id><wp:attachment_url>https://example.com/cover.jpg</wp:attachment_url></item>
  </channel></rss>`;
  const result = parseImportFiles([file('wordpress.xml', xml)]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.candidates.map((c) => c.kind), ['post', 'category', 'page', 'media']);
  assert.deepEqual(result.candidates[0].data.categorySlugs, ['news']);
  assert.equal(result.candidates[0].data.featuredImage, 'https://example.com/cover.jpg');
  assert.equal(result.candidates[2].data.featuredImage, '');
  assert.match(String((result.candidates[2].data.sections as Array<{ html?: string }>)[1].html), /Page body/);
});

test('JSON preview reports individual invalid rows and sanitizes page sections', () => {
  const json = JSON.stringify({ format: 'nextract-content', version: 1, pages: [
    { title: 'Valid page', slug: 'valid-page', sections: [{ id: 'body', type: 'richText', visible: true, html: '<p>Hello</p><script>evil()</script>' }] },
    { title: '', slug: 'bad-page', sections: [] },
  ] });
  const result = parseImportFiles([file('export.json', json)]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.errors.length, 1);
  assert.doesNotMatch(String((result.candidates[0].data.sections as Array<{ html: string }>)[0].html), /script/);
});
