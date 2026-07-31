import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(project, 'dist/client')

async function read(file) {
  return fs.readFile(path.join(output, file), 'utf8')
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
assert.match(home, /data-island="reading-goal"/, 'home should include the React island')
assert.match(home, /data-nib-behavior="theme-toggle"/, 'shell should include the client behavior')
assert.match(home, /data-nib-client-bootstrap/, 'client navigation should contribute its entry')
assert.doesNotMatch(post, /data-island="reading-goal"/, 'post should not include the home island')

const searchIndex = JSON.parse(search)
assert.equal(searchIndex.version, 1)
assert.equal(searchIndex.items.length, 3)
assert.ok(searchIndex.items.every((item) => item.kind === 'post'))

assert.match(rss, /<rss version="2.0"/)
assert.match(rss, /Making room for attention/)
assert.match(sitemap, /https:\/\/commonplace\.example\/posts\/making-room-for-attention\//)

const manifest = JSON.parse(publication)
assert.equal(manifest.trailingSlash, 'always')
assert.ok(manifest.routes.some((route) => (
  route.kind === 'redirect'
  && route.path === '/notes/'
  && route.destination === '/posts/'
)))
assert.match(redirects, /^\/notes\/ \/posts\/ 301!$/m)
assert.equal(JSON.parse(s3).version, 1)

for (const outputText of [home, post, rss, sitemap, search]) {
  assert.doesNotMatch(outputText, /briansunter|personal-site-replica/i)
}

console.info('Blog output checks passed')
