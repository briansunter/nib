import {
  defineConfig,
  fromCollection,
  metadata,
  search,
} from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'
import { clientNavigation } from '@briansunter/nib/navigation'
import { rss } from '@briansunter/nib/rss'
import { sitemap } from '@briansunter/nib/sitemap'
import {
  blogMarkdown,
  posts,
  topicPages,
  topics,
} from './src/content'
import { SiteShell } from './src/site-shell'

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
  trailingSlash: 'always',
  site: {
    title: 'Commonplace',
    origin: 'https://commonplace.example',
    description: 'Sample field notes about making, noticing, and learning.',
    titleTemplate: '%s · Commonplace',
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'Posts', href: '/posts/' },
      { label: 'About', href: '/about/' },
    ],
    head: {
      elements: [
        {
          tag: 'link',
          attributes: {
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/favicon.svg',
          },
        },
        {
          tag: 'link',
          attributes: {
            rel: 'alternate',
            type: 'application/rss+xml',
            href: '/rss.xml',
          },
        },
      ],
    },
  },
  shell: SiteShell,
  markdown: blogMarkdown,
  pageSources: [topicPages],
  collections: { posts, topics },
  redirects: {
    '/notes/': '/posts/',
  },
  hosting: {
    adapters: ['netlify', 's3'],
  },
  plugins: [
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
    metadata({ siteName: 'Commonplace' }),
    clientNavigation({ prefetch: 'explicit' }),
    sitemap({}),
    rss({ items: postFeed }),
    search({ items: postSearch }),
  ],
})
