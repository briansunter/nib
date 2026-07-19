import { defineConfig, definePageSource } from '@briansunter/nib'
import { parse as parseCsv } from 'csv-parse/sync'
import { parse as parseYaml } from 'yaml'
import { markdown, posts } from './src/content'
import {
  ProductPage,
  productSchema,
  TeamMemberPage,
  teamMemberSchema,
} from './src/data-pages'
import { SiteShell } from './src/site-shell'

export default defineConfig({
  base: '/journal/',
  site: {
    title: 'Journal',
    description: 'A test journal.',
    titleTemplate: '%s | Journal',
  },
  shell: SiteShell,
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
