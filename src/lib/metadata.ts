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

// Security: Disallow internal/private networks to prevent SSRF
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') return true;
  if (/^10\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true; // Link-local / Cloud metadata endpoint
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

export async function fetchMetadata(targetUrl: string, initialTitle?: string): Promise<ExtractedMetadata> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    // Protocol whitelist
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }
  } catch {
    return {
      url: targetUrl,
      title: initialTitle || targetUrl,
      description: null,
      image_url: null,
      favicon_url: null,
      domain: targetUrl,
      item_type: 'website',
      youtube_id: null,
    };
  }

  const domain = parsedUrl.hostname.replace(/^www\./, '');
  const defaultFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // 1. YouTube specialized metadata
  const youtubeId = extractYouTubeId(targetUrl);
  if (youtubeId) {
    let title = initialTitle || 'YouTube Video';
    let authorName = '';

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
      const res = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keep/1.0)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
        if (data.author_name) authorName = data.author_name;
      }
    } catch {
      // fallback gracefully
    }

    const description = authorName ? `By ${authorName} on YouTube` : 'YouTube Video';
    const image_url = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;

    return {
      url: targetUrl,
      title: title.replace(/ - YouTube$/, ''),
      description,
      image_url,
      favicon_url: 'https://www.youtube.com/s/desktop/f1725b30/img/favicon_144x144.png',
      domain: 'youtube.com',
      item_type: 'youtube',
      youtube_id: youtubeId,
    };
  }

  // Security: Check for private network SSRF attempts
  if (isPrivateHost(parsedUrl.hostname)) {
    return {
      url: targetUrl,
      title: initialTitle || domain,
      description: null,
      image_url: null,
      favicon_url: defaultFavicon,
      domain,
      item_type: 'website',
      youtube_id: null,
    };
  }

  // 2. Standard website metadata scraping
  let title = initialTitle || domain;
  let description: string | null = null;
  let image_url: string | null = null;
  let favicon_url = defaultFavicon;

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (res.ok && res.body) {
      // Memory safety: Read at most 512KB of HTML
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const MAX_BYTES = 512 * 1024; // 512 KB

      while (totalBytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        totalBytes += value.length;
      }
      reader.cancel().catch(() => {});

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const html = decoder.decode(Buffer.concat(chunks));
      const $ = cheerio.load(html);

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
          // ignore invalid image URL
        }
      }

      // Favicon
      const iconHref = $('link[rel~="icon"]').attr('href') || $('link[rel~="apple-touch-icon"]').attr('href');
      if (iconHref) {
        try {
          const resolvedIcon = new URL(iconHref, targetUrl).href;
          if (resolvedIcon.startsWith('http://') || resolvedIcon.startsWith('https://')) {
            favicon_url = resolvedIcon;
          }
        } catch {
          // fallback to defaultFavicon
        }
      }
    }
  } catch {
    // Graceful fallback on network timeout or blocked bots
  }

  return {
    url: targetUrl,
    title,
    description,
    image_url,
    favicon_url,
    domain,
    item_type: 'website',
    youtube_id: null,
  };
}
