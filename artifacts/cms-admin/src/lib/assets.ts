// CMS values deliberately store portable root-relative URLs. The admin and
// public website can run on different origins, though, so bundled website
// assets must be previewed from the website while CMS uploads stay on the API.
const configuredSiteOrigin = () => {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="cms-public-site-url"]');
    if (meta?.content) return meta.content.replace(/\/+$/, '');
  }
  const fromBuild = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  if (fromBuild) return fromBuild.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return typeof window === 'undefined' ? '' : window.location.origin;
};

export function assetUrl(value: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return value;
  // Local uploads are served by the CMS API, which is also the admin origin.
  if (value === '/uploads' || value.startsWith('/uploads/')) return value;
  return `${configuredSiteOrigin()}${value}`;
}

export function absoluteAssetUrl(value: string) {
  const resolved = assetUrl(value);
  if (!resolved || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(resolved)) return resolved;
  return typeof window === 'undefined' ? resolved : new URL(resolved, window.location.origin).href;
}
