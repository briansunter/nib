import fs from 'node:fs/promises'
import path from 'node:path'
import {
  defineConfig,
  definePageSource,
  fromPageSource,
  markdownMedia,
  metadata,
  pageRenderer,
  search,
} from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'
import { images } from '@briansunter/nib-images/plugin'
import { rss } from '@briansunter/nib/rss'
import { sitemap } from '@briansunter/nib/sitemap'
import {
  art,
  markdown,
  photos,
  pins,
  projectSchema,
  recipeSchema,
  tagPageSchema,
  travel,
  writing,
  type Project,
  type Recipe,
  type TagPage,
  type Writing,
} from './src/content'
import { SiteShell } from './src/site-shell'
import { generateThemeScript } from './src/lib/theme'
import { cooklangToPlainText, htmlToPlainText, markdownToPlainText } from './src/lib/search-text'

function parseJson<T>(raw: string, file: string): T {
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse ${file}: ${detail}`)
  }
}

// Projects: one manifest file emits one route per project at /projects/<slug>.
const projectPages = definePageSource({
  extensions: ['json'],
  patterns: ['/src/content/projects.json'],
  match: (file) => file.replaceAll('\\', '/').endsWith('/src/content/projects.json'),
  schema: projectSchema,
  load: ({ source }) => {
    const projects = parseJson<Project[]>(source, 'projects.json')
    return projects.map((project) => ({
      path: `/projects/${project.slug}`,
      collectionId: project.slug,
      data: project,
      meta: { title: project.title, description: project.description },
    }))
  },
  component: pageRenderer<Project>('./src/data-pages', 'ProjectDetailPage'),
})

// Recipes: one manifest file emits one route per recipe at /recipes/<slug>.
const recipePages = definePageSource({
  extensions: ['json'],
  patterns: ['/src/content/recipes.json'],
  match: (file) => file.replaceAll('\\', '/').endsWith('/src/content/recipes.json'),
  schema: recipeSchema,
  load: ({ source }) => {
    const recipes = parseJson<Recipe[]>(source, 'recipes.json')
    return recipes.map((recipe) => ({
      path: `/recipes/${recipe.slug}`,
      collectionId: recipe.slug,
      data: recipe,
      meta: { title: recipe.metadata.title, description: recipe.metadata.description },
    }))
  },
  component: pageRenderer<Recipe>('./src/data-pages', 'RecipeDetailPage'),
})

// Tags: one manifest file emits one route per tag at /tags/<tag>.
const tagPages = definePageSource({
  extensions: ['json'],
  patterns: ['/src/content/tags.json'],
  match: (file) => file.replaceAll('\\', '/').endsWith('/src/content/tags.json'),
  schema: tagPageSchema,
  load: ({ source }) => {
    const tags = parseJson<TagPage[]>(source, 'tags.json')
    return tags.map((tag) => ({
      path: `/tags/${tag.tag}`,
      collectionId: tag.tag,
      data: tag,
      meta: { title: `#${tag.display}`, description: `${tag.count} item${tag.count === 1 ? '' : 's'} tagged ${tag.display}` },
    }))
  },
  component: pageRenderer<TagPage>('./src/data-pages', 'TagDetailPage'),
})

export default defineConfig({
  vite: () => tailwindcss(),
  // Match the Astro source site's extensionless public URLs.
  trailingSlash: 'never',
  hosting: { adapters: ['netlify', 'vercel', 'cloudflare', 's3'] },
  site: {
    title: 'Brian Sunter',
    origin: 'https://briansunter.com',
    description:
      'Software engineer and writer exploring web development, productivity systems, AI, and creative projects. Sharing insights on building better tools and workflows.',
    // Mirrors SITE_NAVIGATION in the reference site (consts.ts).
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'Writing', href: '/pages' },
      { label: 'Projects', href: '/projects' },
      { label: 'Explore', href: '/explore' },
      { label: 'Newsletter', href: 'https://newsletter.briansunter.com' },
      { label: 'Search', href: '/search' },
    ],
    head: {
      elements: [
        { tag: 'link', attributes: { rel: 'alternate', type: 'application/rss+xml', href: '/index.xml' } },
        { tag: 'link', attributes: { rel: 'manifest', href: '/manifest.webmanifest' } },
        { tag: 'meta', attributes: { name: 'theme-color', 'data-site-theme-color': '', content: '#f5f4f1' } },
        // FOUC-safe theme controller: resolves the effective theme before paint.
        { tag: 'script', content: generateThemeScript() },
      ],
    },
  },
  redirects: {
    // Legacy archive URL now lives at /pages; writing entries moved to root.
    '/notes': '/pages',
    // Canonical RSS feed is /index.xml; keep the legacy path as a redirect.
    '/rss.xml': '/index.xml',
  },
  shell: SiteShell,
  markdown: {
    ...markdown,
    allowDangerousHtml: true,
    rehypePlugins: [
      ...(markdown.rehypePlugins ?? []),
      markdownMedia({
        iframeHosts: [
          'youtube.com',
          'www.youtube.com',
          'youtu.be',
          'google.com',
          'www.google.com',
          'maps.google.com',
        ],
      }),
    ],
  },
  collections: {
    writing,
    projects: fromPageSource(projectPages),
    recipes: fromPageSource(recipePages),
    art,
    photos,
    pins,
    travel,
  },
  pageSources: [projectPages, recipePages, tagPages],
  plugins: [
    images({
      formats: ['avif', 'webp'],
      widths: [320, 480, 640, 960, 1280],
      concurrency: 2,
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
        widths: [320, 640, 1280],
        sizes: '(min-width: 900px) 860px, 100vw',
      }],
    }),
    metadata({
      image: '/blog-placeholder-about.jpg',
      siteName: 'Brian Sunter',
    }),
    search({
      items: async ({ root }) => {
        const readSnapshot = async <T>(file: string): Promise<T> => parseJson<T>(
          await fs.readFile(path.join(root, 'src/content', file), 'utf8'),
          file,
        )
        // Read a writing entry's source Markdown and reduce it to searchable
        // plain text, falling back to its description when a source is missing
        // or empty. Slugs are trusted generated content; guard against escapes.
        const readWritingSource = async (slug: string): Promise<string> => {
          if (slug.includes('..') || slug.startsWith('/')) return ''
          try {
            const source = await fs.readFile(
              path.join(root, 'src/pages', slug, 'page.md'),
              'utf8',
            )
            return markdownToPlainText(source)
          } catch {
            return ''
          }
        }
        const writingEntries = await readSnapshot<Writing[]>('writing.json')
        const projectEntries = await readSnapshot<Project[]>('projects.json')
        const recipeEntries = await readSnapshot<Recipe[]>('recipes.json')
        const writingItems = await Promise.all(writingEntries.map(async (entry) => ({
          title: entry.title,
          description: entry.description,
          href: `/${entry.slug}`,
          kind: 'Writing',
          tags: entry.tags,
          text: (await readWritingSource(entry.slug)) || entry.description,
        })))
        return [
          ...writingItems,
          ...projectEntries.map((entry) => ({
            title: entry.title,
            description: entry.description,
            href: `/projects/${entry.slug}`,
            kind: 'Project',
            tags: entry.tags,
            text: htmlToPlainText(entry.bodyHtml) || entry.description,
          })),
          ...recipeEntries.map((entry) => ({
            title: entry.metadata.title,
            description: entry.metadata.description,
            href: `/recipes/${entry.slug}`,
            kind: 'Recipe',
            tags: entry.metadata.tags,
            text: cooklangToPlainText(entry.sourceText) || entry.metadata.description,
          })),
        ]
      },
    }),
    sitemap({
      filter: (route) => (
        route.path !== '/404'
        && !route.path.startsWith('/search')
        && !route.path.startsWith('/tags')
      ),
    }),
    rss({
      path: '/index.xml',
      language: 'en-us',
      copyright: `© ${new Date().getFullYear()} Brian Sunter`,
      managingEditor: 'noreply@briansunter.com (Brian Sunter)',
      webMaster: 'noreply@briansunter.com (Brian Sunter)',
      stylesheet: '/rss/styles.xsl',
      items: async ({ root: projectRoot, site }) => {
        const contentDir = path.join(projectRoot, 'src/content')
        const origin = (site.origin ?? 'https://briansunter.com').replace(/\/$/, '')
        const readSnapshot = async <T>(file: string): Promise<T> => {
          const raw = await fs.readFile(path.join(contentDir, file), 'utf8')
          try {
            return JSON.parse(raw) as T
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to parse ${file}: ${detail}`)
          }
        }
        // Plugin route inspectors do not receive page data, so the feed reads
        // the same generated snapshots the page sources use.
        const writingEntries = await readSnapshot<Writing[]>('writing.json')
        const projectEntries = await readSnapshot<Project[]>('projects.json')
        return [
          ...writingEntries.map((entry) => ({
            title: entry.title,
            description: entry.description,
            link: `/${entry.slug}`,
            pubDate: entry.date,
            categories: entry.tags,
            creator: 'Brian Sunter',
          })),
          ...projectEntries.map((project) => {
            // Match the original feed: cover image first (when present), then
            // the rendered project body. The static pipeline does not expose
            // the webp@1200 transform to route inspectors, so the cover is
            // referenced by its canonical absolute URL.
            const cover = project.cover
              ? `<p><img src="${origin}${project.cover}" alt=""></p>`
              : ''
            return {
              title: project.title,
              description: project.description,
              link: `/projects/${project.slug}`,
              pubDate: project.date,
              categories: project.tags,
              creator: 'Brian Sunter',
              content: `${cover}${project.bodyHtml}`,
            }
          }),
        ]
      },
    }),
  ],
})
