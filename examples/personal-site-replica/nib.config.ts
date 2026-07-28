import {
  defineConfig,
  definePageSource,
  fromCollection,
  fromPageSource,
  markdownMedia,
  markdownBody,
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
  projectSourceSchema,
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
import { cooklangToPlainText, htmlToPlainText } from './src/lib/search-text'
import { sourceRedirects } from './src/redirects'
import { sourceMetadata } from './src/lib/source-metadata'
import { projectMarkdown } from './src/lib/project-markdown'

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
    const projects = projectSourceSchema.array().parse(
      parseJson<unknown>(source, 'projects.json'),
    )
    return projects.map(({ bodyMarkdown, ...project }) => ({
      path: `/projects/${project.slug}`,
      collectionId: project.slug,
      data: {
        ...project,
        body: markdownBody(bodyMarkdown, {
          file: `src/content/projects/${project.slug}.md`,
          profile: projectMarkdown,
        }),
      },
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
      meta: {
        title: `Posts tagged #${tag.display}`,
        description: `All posts tagged with #${tag.display}`,
      },
    }))
  },
  component: pageRenderer<TagPage>('./src/data-pages', 'TagDetailPage'),
})
const projects = fromPageSource(projectPages)
const recipes = fromPageSource(recipePages)

const writingSearchItems = fromCollection(writing, (entries) => entries.map(({ data }) => ({
  title: data.title,
  description: data.description,
  href: `/${data.slug}`,
  kind: 'Writing',
  tags: data.tags,
  text: data.description,
})))
const projectSearchItems = fromCollection(projects, (entries) => (
  entries.map(({ data }) => ({
    title: data.title,
    description: data.description,
    href: `/projects/${data.slug}`,
    kind: 'Project',
    tags: data.tags,
    text: htmlToPlainText(data.body.html) || data.description,
  }))
))
const recipeSearchItems = fromCollection(recipes, (entries) => (
  entries.map(({ data }) => ({
    title: data.metadata.title,
    description: data.metadata.description,
    href: `/recipes/${data.slug}`,
    kind: 'Recipe',
    tags: data.metadata.tags,
    text: cooklangToPlainText(data.cooklang) || data.metadata.description,
  }))
))
const writingFeedItems = fromCollection(writing, (entries) => entries.map(({ data }) => ({
  title: data.title,
  description: data.description,
  link: `/${data.slug}`,
  pubDate: data.date,
  categories: data.tags,
  creator: 'Brian Sunter',
})))
const projectFeedItems = fromCollection(projects, (entries) => (
  entries.map(({ data: project }) => {
    const cover = project.cover
      ? `<p><img src="https://briansunter.com${project.cover}" alt=""></p>`
      : ''
    return {
      title: project.title,
      description: project.description,
      link: `/projects/${project.slug}`,
      pubDate: project.date,
      categories: project.tags,
      creator: 'Brian Sunter',
      content: `${cover}${project.body.html}`,
    }
  })
))

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
        { tag: 'link', attributes: { rel: 'alternate', type: 'application/rss+xml', title: 'Brian Sunter', href: '/index.xml' } },
        { tag: 'link', attributes: { rel: 'dns-prefetch', href: 'https://a.briansunter.com' } },
        { tag: 'link', attributes: { rel: 'dns-prefetch', href: 'https://subs.briansunter.com' } },
        { tag: 'link', attributes: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
        { tag: 'link', attributes: { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48x48.png' } },
        { tag: 'link', attributes: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' } },
        { tag: 'link', attributes: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
        { tag: 'link', attributes: { rel: 'manifest', href: '/manifest.webmanifest' } },
        { tag: 'meta', attributes: { name: 'theme-color', 'data-site-theme-color': '', content: '#f5f4f1' } },
        // FOUC-safe theme controller: resolves the effective theme before paint.
        { tag: 'script', attributes: { 'data-cfasync': 'false' }, content: generateThemeScript() },
      ],
    },
  },
  redirects: {
    ...sourceRedirects,
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
    projects,
    recipes,
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
    search({
      items: ({ readCollection }) => {
        return [
          ...readCollection(writingSearchItems),
          ...readCollection(projectSearchItems),
          ...readCollection(recipeSearchItems),
        ]
      },
    }),
    sourceMetadata(),
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
      items: ({ readCollection }) => {
        return [
          ...readCollection(writingFeedItems),
          ...readCollection(projectFeedItems),
        ]
      },
    }),
  ],
})
