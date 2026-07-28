import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceDist = path.resolve(
  process.env.PERSONAL_SITE_DIST
    ?? path.join(root, '../../../personal-site/dist'),
)
const client = path.join(root, 'dist/client')
const sourceOnly = process.argv.includes('--source-only')

const routes = [
  {
    route: '/100-newsletter-subscribers',
    directives: 1,
    cards: 1,
    firstText: 'Brainstorming some ideas for blog posts on my public graph.',
  },
  {
    route: '/central-pacific-update',
    directives: 4,
    cards: 4,
    firstText: 'The hottest new programming language is English',
  },
  {
    route: '/convocards-launch-retro',
    directives: 2,
    cards: 2,
    firstText: "I'm launching a new app! ConvoCards",
  },
  {
    route: '/headphone-eye-mask',
    directives: 2,
    cards: 2,
    firstText: 'However, due to circadian shifts in retinal sensitivity',
  },
  {
    route: '/logseq-getting-started',
    directives: 1,
    cards: 1,
    firstText: '@ActivateLearn @rosiesherry @RoamResearch',
  },
  {
    route: '/newsletter/issue-15',
    directives: 1,
    cards: 0,
    unavailable: ['1737855708228669883'],
  },
  {
    route: '/newsletter/issue-2',
    directives: 14,
    cards: 12,
    unavailable: ['1533923814899318785', '1534950374779392009'],
    firstText:
      'One of those can’t-go-back-now-that-I’ve-experienced-this workflows',
  },
  {
    route: '/newsletter/issue-3',
    directives: 19,
    cards: 16,
    unavailable: [
      '1539677453076922368',
      '1539780804192002048',
      '1538689602583764996',
    ],
    firstText: 'My newsest @logseq plugin just launched in the marketplace!',
  },
  {
    route: '/newsletter/issue-5',
    directives: 1,
    cards: 1,
    firstText: 'Best nootropic: sleep',
  },
  {
    route: '/newsletter/issue-7',
    directives: 2,
    cards: 2,
    firstText: '“Boy with the',
  },
  {
    route: '/newsletter/issue-9',
    directives: 5,
    cards: 5,
    firstText: 'Released a new feature for the @logseq @OpenAI GPT-3 plugin!',
  },
  {
    route: '/notetaking-with-ai',
    directives: 4,
    cards: 4,
    firstText: "Now I'm obsessed with Word2vec",
  },
]

const expectedUnavailable = new Set(
  routes.flatMap((entry) => entry.unavailable ?? []),
)
const tweetCache = JSON.parse(
  await readFile(path.join(root, 'src/data/tweet-cache.json'), 'utf8'),
)

function extractTweetId(target) {
  const trimmed = target.trim()
  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const hosts = new Set([
      'x.com',
      'www.x.com',
      'twitter.com',
      'www.twitter.com',
      'mobile.twitter.com',
    ])
    if (!hosts.has(url.hostname.toLowerCase())) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const statusIndex = parts.indexOf('status')
    const id = statusIndex >= 0 ? parts[statusIndex + 1] : undefined
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

function decodeHtml(value = '') {
  return value
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&#(\d+);/g,
      (_match, code) => String.fromCodePoint(Number(code)),
    )
    .replaceAll('&nbsp;', '\u00a0')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function textContent(value = '') {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tweetBodies(html) {
  return [...html.matchAll(
    /<div\s+class=(?:"tweet-body"|'tweet-body')>([\s\S]*?)<\/div>/gi,
  )].map((match) => ({
    html: match[1].replace(/\s+/g, ' ').trim(),
    text: textContent(match[1]),
  }))
}

function countClass(html, className) {
  let count = 0
  for (
    const match of html.matchAll(/class=(?:"([^"]*)"|'([^']*)')/gi)
  ) {
    const classes = (match[1] ?? match[2] ?? '').split(/\s+/)
    if (classes.includes(className)) count += 1
  }
  return count
}

function twitterStatusLinks(html) {
  return [...html.matchAll(
    /href=(?:"(https:\/\/twitter\.com\/[^"]+\/status\/\d+)"|'(https:\/\/twitter\.com\/[^']+\/status\/\d+)')/gi,
  )].map((match) => decodeHtml(match[1] ?? match[2]))
}

function tweetMediaUrls(html) {
  return [...html.matchAll(
    /(?:src|poster)=(?:"(https:\/\/(?:pbs|video)\.twimg\.com\/[^"]+)"|'(https:\/\/(?:pbs|video)\.twimg\.com\/[^']+)')/gi,
  )].map((match) => decodeHtml(match[1] ?? match[2]))
}

function rawTweetDirectiveIds(html) {
  return [...html.matchAll(/\{\{\s*tweet\s+(\d+)\s*\}\}/gi)]
    .map((match) => match[1])
}

function directiveTargets(markdown) {
  return [...markdown.matchAll(
    /^\s*\{\{\s*tweet\s+(.+?)\s*\}\}\s*$/gim,
  )].map((match) => match[1])
}

const sourceErrors = []
for (const expected of routes) {
  const markdown = await readFile(
    path.join(root, 'src/pages', expected.route.slice(1), 'page.md'),
    'utf8',
  )
  const ids = directiveTargets(markdown).map(extractTweetId)
  if (ids.includes(null)) {
    sourceErrors.push(`${expected.route}: malformed tweet directive`)
    continue
  }

  if (ids.length !== expected.directives) {
    sourceErrors.push(
      `${expected.route}: expected ${expected.directives} directives, found ${ids.length}`,
    )
  }

  const cachedIds = ids.filter((id) => tweetCache[id])
  if (cachedIds.length !== expected.cards) {
    sourceErrors.push(
      `${expected.route}: expected ${expected.cards} cached cards, found ${cachedIds.length}`,
    )
  }

  const unavailableIds = ids.filter((id) => !tweetCache[id])
  const expectedIds = expected.unavailable ?? []
  if (
    unavailableIds.length !== expectedIds.length
    || unavailableIds.some((id, index) => id !== expectedIds[index])
  ) {
    sourceErrors.push(
      `${expected.route}: unavailable IDs ${JSON.stringify(unavailableIds)} do not match ${JSON.stringify(expectedIds)}`,
    )
  }

  if (expected.firstText) {
    const firstTweet = tweetCache[cachedIds[0]]
    if (!firstTweet?.text?.includes(expected.firstText)) {
      sourceErrors.push(
        `${expected.route}: first cached tweet is missing ${JSON.stringify(expected.firstText)}`,
      )
    }
  }
}

const allMissingCacheIds = new Set()
for (const expected of routes) {
  const markdown = await readFile(
    path.join(root, 'src/pages', expected.route.slice(1), 'page.md'),
    'utf8',
  )
  for (const target of directiveTargets(markdown)) {
    const id = extractTweetId(target)
    if (id && !tweetCache[id]) allMissingCacheIds.add(id)
  }
}
if (
  allMissingCacheIds.size !== expectedUnavailable.size
  || [...allMissingCacheIds].some((id) => !expectedUnavailable.has(id))
) {
  sourceErrors.push(
    `global unavailable IDs ${JSON.stringify([...allMissingCacheIds])} do not match ${JSON.stringify([...expectedUnavailable])}`,
  )
}

if (sourceErrors.length > 0) {
  throw new Error(
    `Tweet content/cache contract failed:\n- ${sourceErrors.join('\n- ')}`,
  )
}

if (sourceOnly) {
  console.log(JSON.stringify({
    routes: routes.length,
    directives: routes.reduce((sum, entry) => sum + entry.directives, 0),
    cachedCards: routes.reduce((sum, entry) => sum + entry.cards, 0),
    unavailableCards: expectedUnavailable.size,
    result: 'exact route-level tweet content/cache contract',
  }, null, 2))
  process.exit(0)
}

const publication = JSON.parse(
  await readFile(path.join(client, '.nib/publication.json'), 'utf8'),
)
const targetPageMap = new Map(
  publication.routes
    .filter((entry) => entry.kind === 'page')
    .map((entry) => [entry.path, entry]),
)
const structuralClasses = [
  'tweet-card',
  'tweet-author',
  'tweet-verified-badge',
  'tweet-x-logo',
  'tweet-media',
  'tweet-media-grid',
  'tweet-video-container',
  'tweet-gif-container',
  'tweet-show-more',
  'tweet-action-like',
  'tweet-action-reply',
]
const ssrErrors = []

for (const expected of routes) {
  const targetRoute = targetPageMap.get(expected.route)
  if (!targetRoute) {
    ssrErrors.push(`${expected.route}: missing target route`)
    continue
  }

  const sourceHtml = await readFile(
    path.join(sourceDist, `${expected.route.slice(1)}.html`),
    'utf8',
  )
  const targetHtml = await readFile(
    path.join(client, targetRoute.artifact),
    'utf8',
  )
  const sourceBodies = tweetBodies(sourceHtml)
  const targetBodies = tweetBodies(targetHtml)
  const sourceRawDirectives = rawTweetDirectiveIds(sourceHtml)
  const targetRawDirectives = rawTweetDirectiveIds(targetHtml)
  if (
    JSON.stringify(sourceRawDirectives)
    !== JSON.stringify(targetRawDirectives)
  ) {
    ssrErrors.push(
      `${expected.route}: raw unavailable directive sequence differs; source=${JSON.stringify(sourceRawDirectives)} target=${JSON.stringify(targetRawDirectives)}`,
    )
  }
  for (const rawId of targetRawDirectives) {
    if (!expectedUnavailable.has(rawId)) {
      ssrErrors.push(
        `${expected.route}: unexpected raw tweet directive ${rawId}`,
      )
    }
  }

  if (sourceBodies.length !== expected.cards) {
    ssrErrors.push(
      `${expected.route}: source has ${sourceBodies.length} bodies, expected ${expected.cards}`,
    )
  }
  if (targetBodies.length !== expected.cards) {
    ssrErrors.push(
      `${expected.route}: target has ${targetBodies.length} bodies, expected ${expected.cards}`,
    )
  }

  for (
    let index = 0;
    index < Math.max(sourceBodies.length, targetBodies.length);
    index += 1
  ) {
    const sourceBody = sourceBodies[index]
    const targetBody = targetBodies[index]
    if (!sourceBody || !targetBody) continue
    if (sourceBody.text !== targetBody.text) {
      ssrErrors.push(
        `${expected.route} card ${index + 1}: text differs; source=${JSON.stringify(sourceBody.text)} target=${JSON.stringify(targetBody.text)}`,
      )
    }
    if (sourceBody.html !== targetBody.html) {
      ssrErrors.push(
        `${expected.route} card ${index + 1}: linked entity markup differs`,
      )
    }
  }

  for (const className of structuralClasses) {
    const sourceCount = countClass(sourceHtml, className)
    const targetCount = countClass(targetHtml, className)
    if (sourceCount !== targetCount) {
      ssrErrors.push(
        `${expected.route}: .${className} count source=${sourceCount} target=${targetCount}`,
      )
    }
  }

  const sourceLinks = twitterStatusLinks(sourceHtml)
  const targetLinks = twitterStatusLinks(targetHtml)
  if (JSON.stringify(sourceLinks) !== JSON.stringify(targetLinks)) {
    ssrErrors.push(`${expected.route}: tweet status-link sequence differs`)
  }

  const sourceMedia = tweetMediaUrls(sourceHtml)
  const targetMedia = tweetMediaUrls(targetHtml)
  if (JSON.stringify(sourceMedia) !== JSON.stringify(targetMedia)) {
    ssrErrors.push(`${expected.route}: tweet media URL sequence differs`)
  }

  if (/tweet-embed-fallback|data-tweet-id=/i.test(targetHtml)) {
    ssrErrors.push(
      `${expected.route}: fallback or marker leaked into SSR`,
    )
  }
}

if (ssrErrors.length > 0) {
  throw new Error(
    `Tweet SSR parity failed with ${ssrErrors.length} difference(s):\n- ${ssrErrors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  routes: routes.length,
  cards: routes.reduce((sum, entry) => sum + entry.cards, 0),
  unavailableCards: expectedUnavailable.size,
  comparedStructuralClasses: structuralClasses.length,
  result: 'exact source/target tweet count, text, links, media, fallback, and structure parity',
}, null, 2))
