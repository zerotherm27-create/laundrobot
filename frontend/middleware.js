// Vercel Routing Middleware — fixes SEO/link-preview metadata for tenant booking
// pages, both on white-label domains (e.g. book.thelaundryproject.app) and on
// shared-platform path links (laundrobot.app/book/:tenantId, the link most
// tenants actually share — no custom domain required). Both cases serve the same
// built index.html as the main laundrobot.app marketing site, so the static
// <title>, <meta description>, canonical, OG/Twitter tags, and JSON-LD all
// describe the LaundroBot SaaS product — wrong for a tenant's own booking page,
// and (on custom domains) actively harmful: the canonical told crawlers the
// tenant page is a duplicate of www.laundrobot.app, suppressing it from ranking
// under its own name.
//
// HTMLRewriter is NOT available in Vercel's Edge Runtime (confirmed against
// https://edge-runtime.vercel.app/features/available-apis — only fetch/Request/
// Response/streams/crypto primitives are exposed), so this does a plain string
// replace on the known static index.html structure instead of a streaming parse.
import { next } from '@vercel/functions';

const PLATFORM_HOSTS = new Set(['laundrobot.app', 'www.laundrobot.app', 'localhost', '127.0.0.1']);
const API_BASE = 'https://laundrobot-production.up.railway.app';
const DEFAULT_IMAGE = 'https://www.laundrobot.app/og-image.png';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function applyTenantMeta(origin, pageUrl, tenantName, logoUrl) {
  const contentType = origin.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return origin;

  let html = await origin.text();
  const title = `${tenantName} — Book Online`;
  const description = `Book your laundry pickup or delivery online with ${tenantName}.`;
  // tenants.logo_url is often a base64 data: URI (Settings.jsx compresses uploads
  // client-side via canvas.toDataURL) — OG crawlers need a fetchable URL, so a
  // data URI here would silently break the preview image. Only use it if it's real.
  const image = (logoUrl && /^https?:\/\//i.test(logoUrl)) ? logoUrl : DEFAULT_IMAGE;

  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta name="keywords" content=")[^"]*(")/, '$1$2')
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(pageUrl)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(pageUrl)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, '');

  return new Response(html, {
    status: origin.status,
    headers: { 'content-type': contentType },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Only rewrite HTML documents — let static assets (js/css/images/etc.) pass through
  if (/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
    return next();
  }

  const isPlatformHost = PLATFORM_HOSTS.has(hostname) || hostname.endsWith('.vercel.app');

  if (isPlatformHost) {
    // On the shared platform domain, only a /book/:tenantId link carries a
    // specific tenant to preview — leave the marketing site and dashboard alone.
    const bookMatch = url.pathname.match(/^\/book\/([^/]+)/);
    if (!bookMatch) return next();

    let tenant = null;
    try {
      const lookup = await fetch(`${API_BASE}/public/${encodeURIComponent(bookMatch[1])}/info`);
      if (lookup.ok) tenant = await lookup.json();
    } catch {
      // Backend unreachable — fail open and serve the default page unmodified
    }
    if (!tenant?.name) return next();

    const origin = await fetch(request);
    return applyTenantMeta(origin, `${url.origin}${url.pathname}`, tenant.name, tenant.logo_url);
  }

  // Custom (white-label) domain — look up tenant by hostname
  let tenant = null;
  try {
    const lookup = await fetch(`${API_BASE}/public/by-domain/${encodeURIComponent(hostname)}`);
    if (lookup.ok) tenant = await lookup.json();
  } catch {
    // Backend unreachable — fail open and serve the default page unmodified
  }

  if (!tenant?.tenant_name) return next();

  const origin = await fetch(request);
  return applyTenantMeta(origin, `${url.protocol}//${hostname}/`, tenant.tenant_name, tenant.logo_url);
}

export const config = {
  matcher: ['/((?!assets/).*)'],
};
