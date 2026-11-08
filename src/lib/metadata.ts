import * as cheerio from 'cheerio';
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
    // Refresh LRU order
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

// Security: Disallow internal/private networks to prevent SSRF
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') return true;
  if (/^10\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  return false;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        const v = parsed.searchParams.get('v');
        return v && /^[\w-]{11}$/.test(v) ? v : null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/shorts/')[1]?.split(/[?#]/)[0] || '';
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/embed/')[1]?.split(/[?#]/)[0] || '';
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
    } else if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split(/[?#]/)[0] || '';
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {
    // ignore
  }
  return null;
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
    const cleanTitle = (initialTitle || 'YouTube Video').replace(/\s*-\s*YouTube$/i, '').trim();
    return {
      url: targetUrl,
      title: cleanTitle || 'YouTube Video',
      description: 'YouTube Video',
      image_url: `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`,
      favicon_url: 'https://www.youtube.com/s/desktop/f1725b30/img/favicon_144x144.png',
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
    favicon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    domain,
    item_type: 'website',
    youtube_id: null,
  };
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

  // 1. YouTube oEmbed enrichment
  if (fast.youtube_id) {
    let title = fast.title;
    let authorName = '';

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${fast.youtube_id}&format=json`;
      const res = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(2500),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keep/1.0)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = String(data.title).replace(/\s*-\s*YouTube$/i, '');
        if (data.author_name) authorName = String(data.author_name);
      }
    } catch {
      // keep fast fallback
    }

    const enriched: ExtractedMetadata = {
      ...fast,
      title,
      description: authorName ? `By ${authorName} on YouTube` : 'YouTube Video',
    };
    setCachedMeta(targetUrl, enriched);
    return enriched;
  }

  // Security: SSRF check
  if (isPrivateHost(parsedUrl.hostname)) {
    return fast;
  }

  // 2. High-speed HTML <head> streaming scraper (stops immediately at </head>)
  let title = fast.title;
  let description: string | null = null;
  let image_url: string | null = null;
  let favicon_url = fast.favicon_url;

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let htmlHead = '';
      let totalBytes = 0;
      const MAX_BYTES = 196 * 1024; // 196KB max for <head>

      while (totalBytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        totalBytes += value.length;
        htmlHead += decoder.decode(value, { stream: true });
        // Early exit as soon as </head> is reached — skips downloading and parsing <body>!
        const headEndIdx = htmlHead.toLowerCase().indexOf('</head>');
        if (headEndIdx !== -1) {
          htmlHead = htmlHead.slice(0, headEndIdx + 7);
          break;
        }
      }
      reader.cancel().catch(() => {});

      const $ = cheerio.load(htmlHead);

      // Title
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const twTitle = $('meta[name="twitter:title"]').attr('content');
      const pageTitle = $('title').first().text();
      const candidateTitle = ogTitle || twTitle || pageTitle;
      if (candidateTitle && candidateTitle.trim()) {
        title = candidateTitle.trim().slice(0, 300);
      }

      // Description
      const ogDesc = $('meta[property="og:description"]').attr('content');
      const twDesc = $('meta[name="twitter:description"]').attr('content');
      const metaDesc = $('meta[name="description"]').attr('content');
      const desc = (ogDesc || twDesc || metaDesc || '').trim();
      if (desc) {
        description = desc.slice(0, 500);
      }

      // Image
      const ogImg = $('meta[property="og:image"]').attr('content');
      const twImg = $('meta[name="twitter:image"]').attr('content');
      const candidateImg = ogImg || twImg;
      if (candidateImg) {
        try {
          const resolved = new URL(candidateImg, targetUrl).href;
          if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
            image_url = resolved;
          }
        } catch {
          // ignore
        }
      }

      // Favicon
      const iconHref =
        $('link[rel~="icon"]').attr('href') ||
        $('link[rel~="apple-touch-icon"]').attr('href');
      if (iconHref) {
        try {
          const resolvedIcon = new URL(iconHref, targetUrl).href;
          if (resolvedIcon.startsWith('http://') || resolvedIcon.startsWith('https://')) {
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
