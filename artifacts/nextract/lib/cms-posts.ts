import type { CmsResource } from './cms';
import type { BodyBlock, Post } from './posts';

function htmlBlocks(html: string): BodyBlock[] {
  const sanitizedHtml = html.trim();
  // The CMS API sanitizes resource HTML on every write. Keep that safe markup
  // intact here so inline images, links, lists and text formatting survive the
  // API-to-website conversion instead of being flattened to plain text.
  return sanitizedHtml ? [{ kind: 'richText', html: sanitizedHtml }] : [];
}

export function resourceToPost(resource: CmsResource): Post {
  const image = resource.cover ? { src: resource.cover.src, alt: resource.cover.alt, width: 1600, height: 900 } : undefined;
  const related = resource.related?.map((item) => ({
    href: item.path,
    title: item.title,
    meta: item.type === 'EVENT'
      ? 'Event'
      : item.type === 'USE_CASE'
        ? ['Success story', item.useCase?.industry].filter(Boolean).join(' · ')
        : ['Blog', item.readingMinutes ? `${item.readingMinutes} min read` : null].filter(Boolean).join(' · '),
  }));
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
      related,
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
      related,
    };
  }
  return {
    type: 'blog', slug: resource.slug, title: resource.title, excerpt: resource.summary, kicker: resource.readingMinutes ? `${resource.readingMinutes} min read` : 'Blog', image,
    tag: 'Resource', author: resource.author || 'Nextract', authorRole: '',
    date: new Date(resource.publishedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
    body: htmlBlocks(resource.html),
    faqs: resource.faqs ?? [],
    related,
  };
}
