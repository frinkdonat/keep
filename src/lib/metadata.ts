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

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split(/[?#]/)[0] || null;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split(/[?#]/)[0] || null;
      }
    } else if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split(/[?#]/)[0] || null;
    }
  } catch {
    // ignore URL parsing error
  }
  return null;
}

export async function fetchMetadata(targetUrl: string, initialTitle?: string): Promise<ExtractedMetadata> {
  let domain = '';
  try {
    const parsed = new URL(targetUrl);
    domain = parsed.hostname.replace(/^www\./, '');
  } catch {
    domain = targetUrl;
  }

  const defaultFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // 1. Check if it's a YouTube video
  const youtubeId = extractYouTubeId(targetUrl);
  if (youtubeId) {
    let title = initialTitle || 'YouTube Video';
    let authorName = '';

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
      const res = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeepBot/1.0)' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
        if (data.author_name) authorName = data.author_name;
      }
    } catch {
      // fallback to initialTitle or default
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

  // 2. Fetch standard website metadata
  let title = initialTitle || domain;
  let description: string | null = null;
  let image_url: string | null = null;
  let favicon_url = defaultFavicon;

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(4500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract Title
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const twTitle = $('meta[name="twitter:title"]').attr('content');
      const pageTitle = $('title').first().text();
      const h1 = $('h1').first().text();

      const candidateTitle = ogTitle || twTitle || pageTitle || h1;
      if (candidateTitle && candidateTitle.trim()) {
        title = candidateTitle.trim();
      }

      // Extract Description
      const ogDesc = $('meta[property="og:description"]').attr('content');
      const twDesc = $('meta[name="twitter:description"]').attr('content');
      const metaDesc = $('meta[name="description"]').attr('content');
      description = (ogDesc || twDesc || metaDesc || '').trim() || null;

      // Extract Image
      const ogImg = $('meta[property="og:image"]').attr('content');
      const twImg = $('meta[name="twitter:image"]').attr('content');
      const candidateImg = ogImg || twImg;
      if (candidateImg) {
        try {
          image_url = new URL(candidateImg, targetUrl).href;
        } catch {
          image_url = candidateImg;
        }
      }

      // Extract Favicon
      const iconHref = $('link[rel~="icon"]').attr('href') || $('link[rel~="apple-touch-icon"]').attr('href');
      if (iconHref) {
        try {
          favicon_url = new URL(iconHref, targetUrl).href;
        } catch {
          favicon_url = defaultFavicon;
        }
      }
    }
  } catch {
    // graceful fallback: keep whatever initialTitle was passed
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
