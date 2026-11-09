import dns from 'node:dns/promises';
import net from 'node:net';
import { ItemType } from './types';

export interface ExtractedMetadata {
  url: string;
  title: string;
  image_url: string | null;
  favicon_url: string;
  domain: string;
  item_type: ItemType;
  youtube_id: string | null;
}

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
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
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

const DNS_CACHE_LIMIT = 1000;
const DNS_TTL_MS = 10 * 60 * 1000;
const dnsSafetyCache = new Map<string, { safe: boolean; expiresAt: number }>();

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
    host.endsWith('.arpa') ||
    host.endsWith('.box') ||
    host.endsWith('.corp') ||
    host.endsWith('.intranet') ||
    host.endsWith('.test') ||
    host.endsWith('.example') ||
    host.endsWith('.invalid') ||
    host.endsWith('.onion')
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
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const match = /^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(parsed.pathname);
      if (match && match[1]) return match[1];
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
 * Lightweight <head> parser that extracts ONLY title and og:image.
 * Favicons are never scraped from HTML so broken/relative site icons never occur.
 */
function parseHeadTitleAndImage(htmlHead: string): {
  title?: string;
  image?: string;
} {
  let ogTitle = '';
  let twitterTitle = '';
  let ogImage = '';
  let twitterImage = '';

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
    if (!key || !content) continue;
    if (key === 'og:title' && !ogTitle) ogTitle = decodeHtmlEntities(content).trim();
    else if (key === 'twitter:title' && !twitterTitle) twitterTitle = decodeHtmlEntities(content).trim();
    else if (key === 'og:image' && !ogImage) ogImage = decodeHtmlEntities(content).trim();
    else if (key === 'twitter:image' && !twitterImage) twitterImage = decodeHtmlEntities(content).trim();
  }

  let pageTitle = '';
  if (!ogTitle && !twitterTitle) {
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(htmlHead);
    if (titleMatch && titleMatch[1]) {
      pageTitle = decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim();
    }
  }

  return {
    title: ogTitle || twitterTitle || pageTitle || undefined,
    image: ogImage || twitterImage || undefined,
  };
}

export function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

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
    const cleanTitle = (initialTitle || '')
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*-\s*YouTube$/i, '')
      .trim();
    return {
      url: targetUrl,
      title: cleanTitle || 'YouTube Video',
      image_url: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      favicon_url: getGoogleFaviconUrl('youtube.com'),
      domain: 'youtube.com',
      item_type: 'youtube',
      youtube_id: youtubeId,
    };
  }

  return {
    url: targetUrl,
    title: initialTitle?.trim() || domain,
    image_url: null,
    favicon_url: getGoogleFaviconUrl(domain),
    domain,
    item_type: 'website',
    youtube_id: null,
  };
}

/**
 * Fast, single-shot metadata extraction capped at 1.2s total.
 * - YouTube with an existing title (e.g. from Chrome Extension): 0ms (no network call).
 * - YouTube without title: 1.2s oEmbed title lookup.
 * - Websites: 1.2s <head> stream (first 32KB) for title + og:image only, with SSRF protection.
 */
export async function fetchMetadata(
  targetUrl: string,
  initialTitle?: string
): Promise<ExtractedMetadata> {
  const cached = getCachedMeta(targetUrl);
  if (cached) return cached;

  const fast = extractFastMetadata(targetUrl, initialTitle);

  // 1. YouTube handling
  if (fast.youtube_id) {
    const hasRealInitialTitle =
      Boolean(initialTitle) &&
      fast.title !== 'YouTube Video' &&
      fast.title.toLowerCase() !== 'youtube' &&
      fast.title.toLowerCase() !== 'youtube.com';

    if (hasRealInitialTitle) {
      setCachedMeta(targetUrl, fast);
      return fast;
    }

    let title = fast.title;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${fast.youtube_id}&format=json`;
      const res = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(1200),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keep/1.0)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) {
          title = String(data.title).replace(/\s*-\s*YouTube$/i, '').trim().slice(0, 300);
        }
      }
    } catch {
      // keep fast fallback
    }

    const enriched: ExtractedMetadata = { ...fast, title };
    setCachedMeta(targetUrl, enriched);
    return enriched;
  }

  // 2. Website handling (title + og:image only; favicon is always Google S2)
  let title = fast.title;
  let image_url: string | null = null;

  try {
    let currentUrl = targetUrl;
    let res: Response | null = null;

    // Allow up to 2 safe redirects within a strict 1.2s abort deadline
    const deadlineSignal = AbortSignal.timeout(1200);
    for (let hop = 0; hop <= 2; hop++) {
      const parsed = new URL(currentUrl);
      if (!(await isSafePublicUrl(parsed))) {
        res = null;
        break;
      }

      const hopRes = await fetch(currentUrl, {
        redirect: 'manual',
        signal: deadlineSignal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
      });

      if (hopRes.status >= 300 && hopRes.status < 400) {
        const location = hopRes.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      res = hopRes;
      break;
    }

    if (res && res.ok && res.body) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        let htmlHead = '';
        let totalBytes = 0;
        const MAX_BYTES = 32 * 1024; // 32KB cap for <head>

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

        const parsedMeta = parseHeadTitleAndImage(htmlHead);

        if (parsedMeta.title && (!initialTitle || initialTitle === fast.domain)) {
          title = parsedMeta.title.slice(0, 300);
        }
        if (parsedMeta.image) {
          try {
            const resolvedImg = new URL(parsedMeta.image, currentUrl);
            if (
              (resolvedImg.protocol === 'https:' || resolvedImg.protocol === 'http:') &&
              resolvedImg.href.length <= 2048 &&
              !net.isIP(resolvedImg.hostname) &&
              resolvedImg.hostname.toLowerCase() !== 'localhost'
            ) {
              image_url = resolvedImg.href;
            }
          } catch {
            // ignore invalid og:image URL
          }
        }
      }
    }
  } catch {
    // Graceful fallback within 1.2s
  }

  const result: ExtractedMetadata = {
    ...fast,
    title,
    image_url,
  };
  setCachedMeta(targetUrl, result);
  return result;
}
