import type { NewsFeed, NewsItem } from '@xmcl/runtime-api'

const CACHE_TTL = 10 * 60 * 1000
const cache = new Map<string, NewsFeed>()

const supportedLanguages = new Set([
  'fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'pl', 'ru', 'tr', 'zh-cn',
  'sv', 'no', 'da', 'fi', 'cs', 'el', 'hu', 'id', 'th', 'vi', 'uk', 'ar', 'he',
  'hi', 'ro', 'sk', 'bg', 'hr', 'sr', 'lt', 'lv', 'et', 'sl',
])

const regionByLanguage: Record<string, string> = {
  fr: 'FR',
  en: 'US',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  nl: 'NL',
  ja: 'JP',
  ko: 'KR',
  pl: 'PL',
  ru: 'RU',
  tr: 'TR',
  sv: 'SE',
  no: 'NO',
  da: 'DK',
  fi: 'FI',
  cs: 'CZ',
  el: 'GR',
  hu: 'HU',
  id: 'ID',
  th: 'TH',
  vi: 'VN',
  uk: 'UA',
  ar: 'AE',
  he: 'IL',
  hi: 'IN',
  ro: 'RO',
  sk: 'SK',
  bg: 'BG',
  hr: 'HR',
  sr: 'RS',
  lt: 'LT',
  lv: 'LV',
  et: 'EE',
  sl: 'SI',
  'zh-cn': 'CN',
}

export function resolveNewsLocale(locale: string) {
  const normalized = (locale || 'en-US').replace(/_/g, '-').toLowerCase()
  const [rawLanguage, rawRegion] = normalized.split('-')
  const supported = supportedLanguages.has(rawLanguage)
  const language = supported ? rawLanguage : 'en'
  const region = (supported && rawRegion && /^[a-z]{2}$/.test(rawRegion)
    ? rawRegion
    : (regionByLanguage[language] ?? 'us')).toUpperCase()
  return { language, region }
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

/**
 * Parse a Google News RSS payload. Exported so the parsing can be exercised
 * against a real feed without booting Electron.
 */
export function parseGoogleNews(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1]
    const title = decodeEntities(/<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? '')
    const link = decodeEntities(/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? '')
    const source = decodeEntities(/<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] ?? '')
    const publishedAt = decodeEntities(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? '')
    if (!title || !link) continue
    const cleanTitle = source && title.endsWith(` - ${source}`)
      ? title.slice(0, title.length - source.length - 3).trim()
      : title
    const date = new Date(publishedAt)
    items.push({
      title: cleanTitle,
      link,
      source,
      publishedAt: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
      publishedLabel: publishedAt,
    })
  }

  const seen = new Set<string>()
  return items
    .filter((item) => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    })
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    .slice(0, 40)
}

export async function getNews(locale: string, force = false): Promise<NewsFeed> {
  const { language, region } = resolveNewsLocale(locale)
  const key = `${language}:${region}`
  const cached = cache.get(key)
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached

  const query = encodeURIComponent('Minecraft')
  const url = `https://news.google.com/rss/search?q=${query}&hl=${language}&gl=${region}&ceid=${region}:${language}`
  const feed: NewsFeed = { country: region, language, items: [], fetchedAt: Date.now() }

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaCraft/0.74' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    feed.items = parseGoogleNews(await response.text())
    if (!feed.items.length) feed.error = 'empty'
  } catch (error) {
    feed.error = (error as Error).message || 'fetch failed'
  }

  cache.set(key, feed)
  return feed
}
