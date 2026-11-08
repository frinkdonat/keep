import dns from 'node:dns/promises';
import net from 'node:net';
import { ItemType } from './types';

export interface ExtractedMetadata {
  url: string;
  title: string;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  domain: string;
  item_type: ItemType;
  youtube_id: string | null;
}

// In-memory LRU cache for scraped URLs (zero network cost for repeated URLs)
const META_CACHE_LIMIT = 500;
const metadataCache = new Map<string, ExtractedMetadata>();

function getCachedMeta(url: string): ExtractedMetadata | undefined {
  const hit = metadataCache.get(url);
  if (hit) {
    metadataCache.delete(url);
    metadataCache.set(url, hit);
  }
  return hit;
}

function setCachedMeta(url: string, meta: ExtractedMetadata): void {
  if (metadataCache.size >= META_CACHE_LIMIT) {
    const oldestKey = metadataCache.keys().next().value;
    if (oldestKey) metadataCache.delete(oldestKey);
  }
  metadataCache.set(url, meta);
}

/**
 * Validates whether an IPv4 or IPv6 address belongs to a private, loopback,
 * link-local, Docker bridge, Tailscale/CGNAT, or reserved range.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '').toLowerCase();

  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice(7);
    if (net.isIPv4(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
  }

  if (net.isIPv4(clean)) {
    const parts = clean.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  if (net.isIPv6(clean)) {
    if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1') return true;
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
    if (
      clean.startsWith('fe8') ||
      clean.startsWith('fe9') ||
      clean.startsWith('fea') ||
      clean.startsWith('feb')
    ) {
      return true;
    }
    if (clean.startsWith('ff')) return true;
    return false;
  }

  return true;
}

// In-memory LRU cache for DNS SSRF checks (avoids repeated DNS lookups for known safe domains)
const DNS_CACHE_LIMIT = 1000;
const DNS_TTL_MS = 10 * 60 * 1000; // 10 minutes
const dnsSafetyCache = new Map<string, { safe: boolean; expiresAt: number }>();

/**
 * SSRF & DNS Rebinding guard: verifies both the hostname string and all resolved A/AAAA records
 * point exclusively to public internet addresses.
 */
async function isSafePublicUrl(parsed: URL): Promise<boolean> {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.arpa')
  ) {
    return false;
  }

  if (net.isIP(host)) {
    return !isPrivateOrReservedIp(host);
  }

  const now = Date.now();
  const cachedDns = dnsSafetyCache.get(host);
  if (cachedDns && now < cachedDns.expiresAt) {
    return cachedDns.safe;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) return false;
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        dnsSafetyCache.set(host, { safe: false, expiresAt: now + DNS_TTL_MS });
        return false;
      }
    }
    if (dnsSafetyCache.size >= DNS_CACHE_LIMIT) {
      const oldest = dnsSafetyCache.keys().next().value;
      if (oldest) dnsSafetyCache.delete(oldest);
    }
    dnsSafetyCache.set(host, { safe: true, expiresAt: now + DNS_TTL_MS });
    return true;
  } catch {
    return false;
  }
}

export function isValidHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || rawUrl.length > 2048) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = parsed.pathname.slice(1).split(/[/?#]/)[0] || '';
      return /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) {
        return v;
      }
      const match = /^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(parsed.pathname);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    });
}

/**
 * Zero-DOM-allocation <head> parser (~20x faster than constructing a full Cheerio DOM tree).
 */
function parseHeadMetadata(htmlHead: string): {
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
} {
  const metaMap = new Map<string, string>();
  const attrRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g;

  const metaTagRegex = /<meta\b[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = metaTagRegex.exec(htmlHead)) !== null) {
    const tag = tagMatch[0];
    let key = '';
    let content = '';
    attrRegex.lastIndex = 0;
    let attr: RegExpExecArray | null;
    while ((attr = attrRegex.exec(tag)) !== null) {
      const name = attr[1].toLowerCase();
      const val = attr[2] ?? attr[3] ?? attr[4] ?? '';
      if (name === 'property' || name === 'name') {
        key = val.toLowerCase().trim();
      } else if (name === 'content') {
        content = val;
      }
    }
    if (key && content && !metaMap.has(key)) {
      metaMap.set(key, decodeHtmlEntities(content).trim());
    }
  }

  let pageTitle = '';
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(htmlHead);
  if (titleMatch && titleMatch[1]) {
    pageTitle = decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim();
  }

  let icon = '';
  const linkTagRegex = /<link\b[^>]*>/gi;
  while ((tagMatch = linkTagRegex.exec(htmlHead)) !== null) {
    const tag = tagMatch[0];
    let rel = '';
    let href = '';
    attrRegex.lastIndex = 0;
    let attr: RegExpExecArray | null;
    while ((attr = attrRegex.exec(tag)) !== null) {
      const name = attr[1].toLowerCase();
      const val = attr[2] ?? attr[3] ?? attr[4] ?? '';
      if (name === 'rel') rel = val.toLowerCase();
      else if (name === 'href') href = val.trim();
    }
    if (href && (rel.includes('icon') || rel.includes('apple-touch-icon'))) {
      icon = decodeHtmlEntities(href);
      break;
    }
  }

  return {
    title: metaMap.get('og:title') || metaMap.get('twitter:title') || pageTitle || undefined,
    description:
      metaMap.get('og:description') ||
      metaMap.get('twitter:description') ||
      metaMap.get('description') ||
      undefined,
    image: metaMap.get('og:image') || metaMap.get('twitter:image') || undefined,
    icon: icon || undefined,
  };
}

/**
 * Synchronous, zero-I/O metadata extraction (< 0.05ms) for instant item creation
 */
export function extractFastMetadata(
  targetUrl: string,
  initialTitle?: string
): ExtractedMetadata {
  const cached = getCachedMeta(targetUrl);
  if (cached) return cached;

  let domain = targetUrl;
  try {
    const parsed = new URL(targetUrl);
    domain = parsed.hostname.replace(/^www\./, '');
  } catch {
    // fallback
  }

  const youtubeId = extractYouTubeId(targetUrl);
  if (youtubeId) {
    const cleanTitle = (initialTitle || 'YouTube Video')
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*-\s*YouTube$/i, '')
      .trim();
    return {
      url: targetUrl,
      title: cleanTitle || 'YouTube Video',
      description: 'YouTube Video',
      image_url: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      favicon_url: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
      domain: 'youtube.com',
      item_type: 'youtube',
      youtube_id: youtubeId,
    };
  }

  return {
    url: targetUrl,
    title: initialTitle || domain,
    description: null,
    image_url: null,
    favicon_url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    domain,
    item_type: 'website',
    youtube_id: null,
  };
}

/**
 * Fetches URL with manual redirect validation so an external URL cannot 302-redirect
 * into internal LAN / localhost addresses (SSRF redirect bypass defense).
 */
async function safeFetchWithRedirects(url: string, maxRedirects = 3): Promise<Response | null> {
  let currentUrl = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return null;
    }

    const safe = await isSafePublicUrl(parsed);
    if (!safe) {
      return null;
    }

    const res = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(2200),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      try {
        currentUrl = new URL(location, currentUrl).href;
        continue;
      } catch {
        return null;
      }
    }

    return res;
  }
  return null;
}

export async function fetchMetadata(
  targetUrl: string,
  initialTitle?: string
): Promise<ExtractedMetadata> {
  const cached = getCachedMeta(targetUrl);
  if (cached) return cached;

  const fast = extractFastMetadata(targetUrl, initialTitle);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return fast;
    }
  } catch {
    return fast;
  }

  // 1. YouTube oEmbed enrichment (fast JSON endpoint)
  if (fast.youtube_id) {
    let title = fast.title;
    let authorName = '';
    let image_url = fast.image_url;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${fast.youtube_id}&format=json`;
      const res = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(2000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keep/1.0)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) {
          title = String(data.title).replace(/\s*-\s*YouTube$/i, '').slice(0, 300);
        }
        if (data.author_name) {
          authorName = String(data.author_name).slice(0, 120);
        }
        if (typeof data.thumbnail_url === 'string' && data.thumbnail_url.startsWith('https://')) {
          image_url = data.thumbnail_url;
        }
      }
    } catch {
      // keep fast fallback
    }

    const enriched: ExtractedMetadata = {
      ...fast,
      title,
      image_url,
      description: authorName ? `By ${authorName} on YouTube` : 'YouTube Video',
    };
    setCachedMeta(targetUrl, enriched);
    return enriched;
  }

  // 2. High-speed HTML <head> streaming scraper with SSRF & DNS-rebinding protection
  let title = fast.title;
  let description: string | null = null;
  let image_url: string | null = null;
  let favicon_url = fast.favicon_url;

  try {
    const res = await safeFetchWithRedirects(targetUrl, 3);

    if (res && res.ok && res.body) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return fast;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let htmlHead = '';
      let totalBytes = 0;
      const MAX_BYTES = 64 * 1024; // 64KB cap for <head>

      while (totalBytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        totalBytes += value.length;
        htmlHead += decoder.decode(value, { stream: true });
        const headEndIdx = htmlHead.toLowerCase().indexOf('</head>');
        if (headEndIdx !== -1) {
          htmlHead = htmlHead.slice(0, headEndIdx + 7);
          break;
        }
      }
      reader.cancel().catch(() => {});

      const parsedMeta = parseHeadMetadata(htmlHead);

      // Preserve user/extension-supplied initialTitle if present, otherwise use scraped title
      if (parsedMeta.title && (!initialTitle || initialTitle === fast.domain)) {
        title = parsedMeta.title.slice(0, 300);
      } else if (!initialTitle && parsedMeta.title) {
        title = parsedMeta.title.slice(0, 300);
      }
      if (parsedMeta.description) {
        description = parsedMeta.description.slice(0, 500);
      }
      if (parsedMeta.image) {
        try {
          const resolved = new URL(parsedMeta.image, targetUrl).href;
          if (
            (resolved.startsWith('http://') || resolved.startsWith('https://')) &&
            resolved.length <= 2048
          ) {
            image_url = resolved;
          }
        } catch {
          // ignore
        }
      }
      if (parsedMeta.icon) {
        try {
          const resolvedIcon = new URL(parsedMeta.icon, targetUrl).href;
          if (
            (resolvedIcon.startsWith('http://') || resolvedIcon.startsWith('https://')) &&
            resolvedIcon.length <= 2048
          ) {
            favicon_url = resolvedIcon;
          }
        } catch {
          // keep default
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  const result: ExtractedMetadata = {
    ...fast,
    title,
    description,
    image_url,
    favicon_url,
  };
  setCachedMeta(targetUrl, result);
  return result;
}
