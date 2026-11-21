import type { CmsResource } from './cms';
import type { BodyBlock, Post } from './posts';

function plain(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function htmlBlocks(html: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const match of html.matchAll(/<(h[2-4]|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = match[1].toLowerCase();
    const text = plain(match[2]);
    if (!text) continue;
    if (tag.startsWith('h')) blocks.push({ kind: 'heading', text });
    else if (tag === 'blockquote') blocks.push({ kind: 'quote', text });
    else if (tag === 'li') blocks.push({ kind: 'list', items: [text] });
    else blocks.push({ kind: 'paragraph', text });
  }
  return blocks.length ? blocks : html.trim() ? [{ kind: 'paragraph', text: plain(html) }] : [];
}

export function resourceToPost(resource: CmsResource): Post {
  const image = resource.cover ? { src: resource.cover.src, alt: resource.cover.alt, width: 1600, height: 900 } : undefined;
  if (resource.type === 'EVENT') {
    const event = resource.event!;
    const starts = new Date(event.startsAt);
    const fallbackBody: BodyBlock[] = [
      ...(event.audience ? [{ kind: 'paragraph' as const, text: event.audience }] : []),
      ...(event.learn.length ? [{ kind: 'heading' as const, text: 'What you will learn' }, { kind: 'list' as const, items: event.learn }] : []),
    ];
    const body = resource.html.trim() ? htmlBlocks(resource.html) : fallbackBody;
    return {
      type: 'event', slug: resource.slug, title: resource.title, excerpt: resource.summary, kicker: 'Event', image, body,
      faqs: resource.faqs ?? [],
      format: event.format,
      date: starts.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: event.timeZone }),
      time: starts.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: event.timeZone }),
      location: event.location || 'Online',
      duration: event.endsAt ? `${Math.max(1, Math.round((Date.parse(event.endsAt) - starts.getTime()) / 60000))} minutes` : '',
      speakers: event.speakers,
    };
  }
  if (resource.type === 'USE_CASE') {
    const useCase = resource.useCase!;
    const fallbackBody: BodyBlock[] = [
      ...(useCase.challenge ? [{ kind: 'heading' as const, text: 'The challenge' }, { kind: 'paragraph' as const, text: useCase.challenge }] : []),
      ...(useCase.approach.length ? [{ kind: 'heading' as const, text: 'The approach' }, { kind: 'list' as const, items: useCase.approach }] : []),
      ...(useCase.benefits.length ? [{ kind: 'heading' as const, text: 'Benefits' }, { kind: 'list' as const, items: useCase.benefits }] : []),
    ];
    return {
      type: 'success-story', slug: resource.slug, title: resource.title, excerpt: resource.summary, kicker: 'Success story', image,
      industry: useCase.industry, timeline: useCase.timeline,
      results: useCase.verifiedOutcomes.map((label) => ({ value: '✓', label })),
      body: resource.html.trim() ? htmlBlocks(resource.html) : fallbackBody,
      faqs: resource.faqs ?? [],
    };
  }
  return {
    type: 'blog', slug: resource.slug, title: resource.title, excerpt: resource.summary, kicker: resource.readingMinutes ? `${resource.readingMinutes} min read` : 'Blog', image,
    tag: 'Resource', author: resource.author || 'Nextract', authorRole: '',
    date: new Date(resource.publishedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
    body: htmlBlocks(resource.html),
    faqs: resource.faqs ?? [],
  };
}
