import {
  defineConfig,
  fromCollection,
  metadata,
  search,
  siteMetadata,
} from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'
import { rss } from '@briansunter/nib/rss'
import { sitemap } from '@briansunter/nib/sitemap'
import {
  blogMarkdown,
  posts,
  topicPages,
  topics,
} from './src/content'
import { SiteShell } from './src/site-shell'
import { site } from './src/site'

function deploymentBase(): string {
  const configured = process.env.SITE_BASE_PATH
  if (configured !== undefined && configured !== '') {
    const normalized = configured.startsWith('/') ? configured : `/${configured}`
    return normalized.endsWith('/') ? normalized : `${normalized}/`
  }
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
  return process.env.GITHUB_ACTIONS === 'true' && repository
    ? `/${repository}/`
    : '/'
}

const base = deploymentBase()
const publicHref = (path: string): string => `${base}${path.replace(/^\/+/, '')}`

const postFeed = fromCollection(posts, (entries) => entries.map(({ data }) => ({
  title: data.title,
  link: data.path,
  description: data.description,
  pubDate: data.date,
  categories: data.tags,
})))

const postSearch = fromCollection(posts, (entries) => entries.map(({ data }) => ({
  title: data.title,
  description: data.description,
  href: data.path,
  kind: 'post',
  tags: data.tags,
})))

export default defineConfig({
  base,
  trailingSlash: 'always',
  origin: 'https://commonplace.example',
  shell: SiteShell,
  markdown: blogMarkdown,
  collections: { posts, topics },
  derivedPages: [topicPages],
  redirects: {
    '/notes/': '/posts/',
  },
  hosting: {
    adapters: ['netlify', 's3'],
  },
  plugins: [
    siteMetadata({
      title: site.name,
      description: site.description,
      titleTemplate: `%s · ${site.name}`,
      head: {
        elements: [
          {
            tag: 'link',
            attributes: {
              rel: 'icon',
              type: 'image/svg+xml',
              href: publicHref('/favicon.svg'),
            },
          },
          {
            tag: 'link',
            attributes: {
              rel: 'alternate',
              type: 'application/rss+xml',
              href: publicHref('/rss.xml'),
            },
          },
        ],
      },
    }),
    images({
      widths: [320, 640, 960],
      content: [{
        publicPath: '/images/',
        directory: 'src/assets/images',
        widths: [320, 640, 960],
        sizes: '(min-width: 720px) 44rem, calc(100vw - 2rem)',
        maxWidth: 960,
      }],
    }),
    metadata({ siteName: site.name }),
    sitemap(),
    rss({
      title: site.name,
      description: site.description,
      items: postFeed,
    }),
    search({ items: postSearch }),
  ],
})
