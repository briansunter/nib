import { defineConfig, definePageSource, fromPageSource, pageRenderer } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'
import { rss } from '@briansunter/nib/rss'
import { sitemap } from '@briansunter/nib/sitemap'
import { parse as parseYaml } from 'yaml'
import { markdown, posts, projectSchema, type Project } from './src/content'
import { SiteShell } from './src/site-shell'

const projectPages = definePageSource({
  extensions: ['yaml', 'yml'],
  match: (file) => file.replaceAll('\\', '/').includes('/src/pages/projects/'),
  schema: projectSchema,
  load: ({ source, defaultPath }) => {
    const data = parseYaml(source)
    return {
      path: defaultPath,
      data,
      meta: {
        title: data.title,
        description: data.description,
      },
    }
  },
  // Nib imports this only in its configured Vite data-page graph, after images().
  component: pageRenderer<Project>('./src/data-pages', 'ProjectDetailPage'),
})

export default defineConfig({
  // Match the Astro source site's extensionless public URLs.
  trailingSlash: 'never',
  site: {
    title: 'Brian Sunter',
    origin: 'https://briansunter.com',
    description: 'Software engineer, entrepreneur, and AI enthusiast.',
    titleTemplate: '%s | Brian Sunter',
    navigation: [
      { label: 'Writing', href: '/notes' },
      { label: 'Projects', href: '/projects' },
      { label: 'Recipes', href: '/recipes' },
      { label: 'Art', href: '/art' },
      { label: 'Photos', href: '/photos' },
      { label: 'About', href: '/about' },
    ],
  },
  shell: SiteShell,
  markdown,
  collections: { posts, projects: fromPageSource(projectPages) },
  pageSources: [projectPages],
  plugins: [
    images({
      formats: ['avif', 'webp'],
      widths: [320, 480, 640, 960, 1280],
      concurrency: 2,
    }),
    sitemap({
      filter: (route) => (
        route.path !== '/404'
        && !route.path.startsWith('/search')
        && !route.path.startsWith('/tags')
      ),
    }),
    rss({
      items: ({ routes }) => routes.flatMap((route) => (
        route.kind === 'page' && route.path.startsWith('/notes/') && route.path !== '/notes/'
          ? [{
              title: route.meta.title ?? route.path,
              description: route.meta.description ?? 'A note from the archive.',
              link: route.path,
            }]
          : []
      )),
    }),
  ],
})
