import type { PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { PageHero } from '../../components/PageHero'
import { ProjectCard } from '../../components/ProjectCard'
import { ProjectFilter } from '../../client-behaviors'
import { stripPageSuffix } from '../../lib/content-queries'

export const meta = {
  title: 'Projects',
  description: 'A collection of software projects, experiments, and open source contributions',
}

export default function ProjectsPage({ collections, site }: PageProps<typeof config>) {
  const projects = [...collections.projects].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  const featured = projects.filter((project) => project.data.featured)
  const rest = projects.filter((project) => !project.data.featured)
  const tagCounts = new Map<string, number>()
  for (const project of projects) {
    for (const rawTag of project.data.tags) {
      const tag = stripPageSuffix(rawTag).trim()
      if (tag && !['project', 'project-page'].includes(tag.toLowerCase())) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
  }
  const browseTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const preferred = ['TypeScript', 'Bun', 'React', 'MCP', 'AI', 'Astro', 'Python', 'Rust']
  const quickTags = preferred.flatMap((name) => {
    const match = browseTags.find(([tag]) => tag.toLowerCase() === name.toLowerCase())
    return match ? [match] : []
  })
  const filterTags = [
    { value: '', label: 'All', count: projects.length },
    ...quickTags.map(([label, count]) => ({ value: label.toLowerCase(), label, count })),
  ]
  const origin = (site.origin ?? 'https://briansunter.com').replace(/\/$/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Projects',
    description: 'Software projects, experiments, and open source contributions by Brian Sunter.',
    url: `${origin}/projects`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: projects.length,
      itemListElement: projects.map((project, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: project.data.title,
        url: `${origin}/projects/${project.data.slug}`,
      })),
    },
  }
  return (
    <div className="projects-index py-10 sm:py-16 md:py-20" data-project-browser data-pagefind-ignore id="project-list">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero title="Projects">
        Software projects, experiments, and open source contributions.
        <span className="block mt-2 font-sans text-base md:text-lg">
          <span className="font-semibold text-ink tabular-nums">{projects.length}</span> projects.
        </span>
      </PageHero>
      <form className="project-filters" data-project-filters>
        <div className="project-filter-heading">
          <p className="overline-label">Browse projects</p>
          <p className="project-filter-hint">Choose a focus</p>
        </div>
        <fieldset className="project-filter-scroll">
          <legend className="sr-only">Filter projects by technology or topic</legend>
          <div className="project-filter-rail">
            {filterTags.map((tag) => (
              <button
                type="button"
                className="chip chip--pill project-filter-chip"
                value={tag.value}
                data-project-tag
                data-project-tag-label={tag.value ? tag.label : 'all'}
                aria-pressed={tag.value ? 'false' : 'true'}
                key={tag.value || 'all'}
              >
                <span>{tag.label}</span>{' '}
                <span className="chip-count">{tag.count}</span>{' '}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
      <p className="mt-4 font-sans text-sm text-ink-muted" role="status" aria-live="polite" data-project-status>
        Showing all {projects.length} projects.
      </p>
      <ProjectFilter props={{}} hydrate="load" />
      {featured.length > 0 && (
        <section className="projects-section" aria-labelledby="featured-heading" data-project-section>
          <header className="section-head">
            <h2 id="featured-heading" className="section-title">Featured</h2>
            <span className="section-rule" aria-hidden="true" />
            <span className="section-count" data-project-section-count>{featured.length} projects</span>
          </header>
          <div className="space-y-6 md:space-y-8">
            {featured.map((entry, index) => (
              <ProjectCard
                key={entry.id}
                project={entry.data}
                analyticsSection="featured"
                eager={index < 2}
              />
            ))}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section className="projects-section" aria-labelledby="all-heading" data-project-section>
          <header className="section-head">
            <h2 id="all-heading" className="section-title">{featured.length > 0 ? 'All Projects' : 'Projects'}</h2>
            <span className="section-rule" aria-hidden="true" />
            <span className="section-count" data-project-section-count>{rest.length} projects</span>
          </header>
          <div className="space-y-6 md:space-y-8">
            {rest.map((entry, index) => (
              <ProjectCard
                key={entry.id}
                project={entry.data}
                analyticsSection={featured.length === 0 ? 'all' : 'more'}
                eager={featured.length === 0 && index < 4}
              />
            ))}
          </div>
        </section>
      )}
      {projects.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-xl text-ink-secondary">No projects yet. Check back soon!</p>
        </div>
      )}
    </div>
  )
}
