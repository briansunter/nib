import type { PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { ProjectCard } from '../../components/ProjectCard'
import { SectionHeading } from '../../components/SectionHeading'
import ProjectFilter from '../../islands/project-filter'

export const meta = {
  title: 'Projects',
  description: 'Software projects, experiments, and open source contributions.',
}

export default function ProjectsPage({ collections }: PageProps<typeof config>) {
  const projects = [...collections.projects].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  const featured = projects.filter((project) => project.data.featured)
  const rest = projects.filter((project) => !project.data.featured)
  const tagCounts = new Map<string, number>()
  for (const project of projects) for (const tag of project.data.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  const tags = [...tagCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([label, count]) => ({ value: label.toLowerCase(), label, count }))
  const filterTags = [{ value: '', label: 'All', count: projects.length }, ...tags]

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">A shelf of experiments</p>
        <h1>Projects</h1>
        <p className="lead">Software projects, experiments, and open source contributions. Each card and detail route is generated from typed YAML metadata.</p>
        <p className="project-count">{projects.length} projects</p>
      </header>
      <section className="content-column project-index" id="project-list">
        <ProjectFilter tags={filterTags} listId="project-list" hydrate="load" />
        {featured.length > 0 && (
          <>
            <SectionHeading title="Featured" />
            <div className="project-list">{featured.map((entry) => <ProjectCard key={entry.id} project={entry.data} />)}</div>
          </>
        )}
        <SectionHeading title={featured.length > 0 ? 'More projects' : 'Projects'} />
        <div className="project-list">{rest.map((entry) => <ProjectCard key={entry.id} project={entry.data} />)}</div>
      </section>
    </div>
  )
}
