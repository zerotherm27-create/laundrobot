// Vercel Routing Middleware — fixes SEO/link-preview metadata on tenant white-label
// domains (e.g. book.thelaundryproject.app). Those domains serve the same built
// index.html as the main laundrobot.app marketing site, so the static <title>,
// <meta description>, canonical, OG/Twitter tags, and JSON-LD all describe the
// LaundroBot SaaS product — wrong for a tenant's own booking page, and actively
// harmful (the canonical told crawlers the tenant page is a duplicate of
// www.laundrobot.app, suppressing it from ranking under its own name).
//
// HTMLRewriter is NOT available in Vercel's Edge Runtime (confirmed against
// https://edge-runtime.vercel.app/features/available-apis — only fetch/Request/
// Response/streams/crypto primitives are exposed), so this does a plain string
// replace on the known static index.html structure instead of a streaming parse.
import { next } from '@vercel/functions';

const PLATFORM_HOSTS = new Set(['laundrobot.app', 'www.laundrobot.app', 'localhost', '127.0.0.1']);
const API_BASE = 'https://laundrobot-production.up.railway.app';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default async function middleware(request) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Only intervene on custom (white-label) domains — leave the main platform hosts alone
  if (PLATFORM_HOSTS.has(hostname) || hostname.endsWith('.vercel.app')) {
    return next();
  }

  // Only rewrite HTML documents — let static assets (js/css/images/etc.) pass through
  if (/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
    return next();
  }

  let tenantName = null;
  try {
    const lookup = await fetch(`${API_BASE}/public/by-domain/${encodeURIComponent(hostname)}`);
    if (lookup.ok) {
      const data = await lookup.json();
      tenantName = data.tenant_name || null;
    }
  } catch {
    // Backend unreachable — fail open and serve the default page unmodified
  }

  if (!tenantName) return next();

  const origin = await fetch(request);
  const contentType = origin.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return origin;

  let html = await origin.text();
  const title = `${tenantName} — Book Online`;
  const description = `Book your laundry pickup or delivery online with ${tenantName}.`;
  const pageUrl = `${url.protocol}//${hostname}/`;

  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta name="keywords" content=")[^"]*(")/, '$1$2')
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(pageUrl)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(pageUrl)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, '');

  return new Response(html, {
    status: origin.status,
    headers: { 'content-type': contentType },
  });
}

export const config = {
  matcher: ['/((?!assets/).*)'],
};
