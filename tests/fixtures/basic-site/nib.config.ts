import { defineConfig, definePageSource } from '@briansunter/nib'
import { parse as parseCsv } from 'csv-parse/sync'
import { parse as parseYaml } from 'yaml'
import { rss } from '@briansunter/nib/rss'
import { sitemap } from '@briansunter/nib/sitemap'
import { markdown, posts } from './src/content'
import {
  ProductPage,
  productSchema,
  TeamMemberPage,
  teamMemberSchema,
} from './src/data-pages'
import { SiteShell } from './src/site-shell'
import { tomlPages, virtualRoutes } from './src/plugins'

export default defineConfig({
  base: '/journal/',
  trailingSlash: 'always',
  redirects: {
    '/legacy': '/about',
  },
  site: {
    title: 'Journal',
    description: 'A test journal.',
    titleTemplate: '%s | Journal',
  },
  shell: SiteShell,
  plugins: [
    tomlPages(),
    sitemap({ site: 'https://example.test' }),
    rss({
      site: 'https://example.test',
      title: 'Journal',
      description: 'A test journal.',
      items: [
        {
          title: 'About the journal',
          link: '/about/',
          description: 'How the test journal is made.',
          pubDate: '2026-07-19T00:00:00Z',
        },
      ],
    }),
    virtualRoutes(),
  ],
  markdown,
  collections: { posts },
  pageSources: [
    definePageSource({
      extensions: ['yaml', 'yml'],
      schema: teamMemberSchema,
      load: ({ source }) => ({ data: parseYaml(source) }),
      component: TeamMemberPage,
    }),
    definePageSource({
      extensions: ['csv'],
      schema: productSchema,
      load: ({ source }) => (
        parseCsv(source, { columns: true, skip_empty_lines: true }) as unknown[]
      ).map((data) => {
        const row = data as { slug: string }
        return {
          path: `/products/${row.slug}`,
          data,
          meta: { title: row.slug },
        }
      }),
      component: ProductPage,
    }),
  ],
})
