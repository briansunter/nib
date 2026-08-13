import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(project, 'dist/client')

async function read(file) {
  return fs.readFile(path.join(output, file), 'utf8')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const [
  home,
  post,
  rss,
  sitemap,
  search,
  publication,
  redirects,
  s3,
] = await Promise.all([
  read('index.html'),
  read('posts/making-room-for-attention/index.html'),
  read('rss.xml'),
  read('sitemap.xml'),
  read('search.json'),
  read('.nib/publication.json'),
  read('_redirects'),
  read('s3-website.json'),
])

assert.match(home, /<picture>/, 'home should contain an optimized picture')
assert.match(home, /srcSet=/, 'home should contain responsive image candidates')
assert.match(post, /<picture>/, 'Markdown content images should be optimized')
assert.match(home, /data-nib-enhancement="reading-goal"/, 'home should include the reading-goal enhancement')
assert.match(home, /data-nib-enhancement="theme-toggle"/, 'shell should include the client enhancement')
assert.doesNotMatch(post, /data-nib-enhancement="reading-goal"/, 'post should not include the home enhancement')

const searchIndex = JSON.parse(search)
assert.equal(searchIndex.version, 1)
assert.equal(searchIndex.items.length, 3)
assert.ok(searchIndex.items.every((item) => item.kind === 'post'))

const manifest = JSON.parse(publication)
assert.equal(manifest.trailingSlash, 'always')
const base = manifest.base === '/' ? '' : manifest.base.replace(/\/$/, '')

assert.match(rss, /<rss version="2.0"/)
assert.match(rss, /Making room for attention/)
assert.match(
  sitemap,
  new RegExp(escapeRegExp(`https://commonplace.example${base}/posts/making-room-for-attention/`)),
)
assert.match(home, new RegExp(`href="${escapeRegExp(`${manifest.base}favicon.svg`)}"`))

assert.ok(manifest.routes.some((route) => (
  route.kind === 'redirect'
  && route.path === '/notes/'
  && route.destination === `${manifest.base}posts/`
)))
assert.match(redirects, new RegExp(
  `^${escapeRegExp(`${manifest.base}notes/`)} ${escapeRegExp(`${manifest.base}posts/`)} 301!$`,
  'm',
))
assert.equal(JSON.parse(s3).version, 1)

for (const outputText of [home, post, rss, sitemap, search]) {
  assert.doesNotMatch(outputText, /briansunter|personal-site-replica/i)
}

console.info('Blog output checks passed')
