import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { env } from "@/lib/env";

export type SitemapUrl = {
  loc: string;
  lastmod: string | null;
};

const parser = new XMLParser({
  ignoreAttributes: false
});

type ParsedSitemapEntry = {
  loc?: string;
  lastmod?: string;
};

type ParsedSitemap = {
  sitemapindex?: {
    sitemap?: ParsedSitemapEntry | ParsedSitemapEntry[];
  };
  urlset?: {
    url?: ParsedSitemapEntry | ParsedSitemapEntry[];
  };
};

export async function fetchSitemap(
  url = `${env.WORDPRESS_BASE_URL}/sitemap_index.xml`
): Promise<SitemapUrl[]> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap ${url}: ${response.status}`);
  }

  const xml = await response.text();

  if (/^\s*</.test(xml) && /<html[\s>]/i.test(xml)) {
    return extractSitemapUrlsFromHtml(xml, url);
  }

  const parsed = parser.parse(xml) as ParsedSitemap;

  if (parsed.sitemapindex?.sitemap) {
    const sitemaps = toArray(parsed.sitemapindex.sitemap)
      .map((entry) => entry.loc)
      .filter((loc): loc is string => typeof loc === "string");
    const nestedResults: SitemapUrl[][] = await Promise.all(
      sitemaps.map((sitemapUrl) => fetchSitemap(sitemapUrl))
    );

    return nestedResults.flat();
  }

  if (parsed.urlset?.url) {
    return toArray(parsed.urlset.url)
      .map((entry) => ({
        loc: entry.loc,
        lastmod: typeof entry.lastmod === "string" ? entry.lastmod : null
      }))
      .filter((entry): entry is SitemapUrl => typeof entry.loc === "string");
  }

  return [];
}

function extractSitemapUrlsFromHtml(html: string, currentUrl: string): SitemapUrl[] {
  const $ = load(html);
  const candidates = new Set<string>();
  const pageCandidates = new Set<string>();
  const currentOrigin = new URL(currentUrl).origin;

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const absoluteUrl = new URL(href, currentUrl).toString();

    const parsedUrl = new URL(absoluteUrl);

    const currentParsedUrl = new URL(currentUrl);

    if (
      absoluteUrl.includes(".xml") &&
      parsedUrl.hash.length === 0 &&
      parsedUrl.pathname !== currentParsedUrl.pathname
    ) {
      candidates.add(absoluteUrl);
      return;
    }

    if (parsedUrl.origin === currentOrigin && isLikelyPublicPage(parsedUrl)) {
      pageCandidates.add(parsedUrl.toString());
    }
  });

  const urls = candidates.size > 0 ? Array.from(candidates) : Array.from(pageCandidates);

  if (urls.length === 0) {
    urls.push(new URL("/", currentOrigin).toString());
  }

  return urls.map((loc) => ({
    loc,
    lastmod: null
  }));
}

function isLikelyPublicPage(url: URL) {
  return (
    url.hash.length === 0 &&
    !url.pathname.includes("/wp-admin") &&
    !url.pathname.includes("/wp-content") &&
    !url.pathname.match(/\.(png|jpe?g|gif|webp|svg|pdf|zip|css|js)$/i)
  );
}

function toArray<T>(value: T | T[]) {
  return Array.isArray(value) ? value : [value];
}
