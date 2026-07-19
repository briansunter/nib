import { type PageProps, siteHref } from '@briansunter/nib'
import type config from '../../../nib.config'
import { ProjectCard } from '../../components/ProjectCard'
import { SectionHeading } from '../../components/SectionHeading'

export const meta = {
  title: 'Projects',
  description: 'Software projects, experiments, and open source contributions.',
}

export default function ProjectsPage({ collections }: PageProps<typeof config>) {
  const projects = [...collections.projects].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  const featured = projects.filter((project) => project.data.featured)
  const rest = projects.filter((project) => !project.data.featured)
  const tags = [...new Set(projects.flatMap((project) => project.data.tags))].slice(0, 8)

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">A shelf of experiments</p>
        <h1>Projects</h1>
        <p className="lead">Software projects, experiments, and open source contributions. Each card and detail route is generated from typed YAML.</p>
        <p className="project-count">{projects.length} projects</p>
      </header>
      <section className="content-column project-index">
        <div className="tag-rail" aria-label="Project tags">
          <span className="eyebrow">Browse by focus</span>
          {tags.map((tag) => <a className="tag tag--pill" href={siteHref(`/tags/${tag.toLowerCase()}`)} key={tag}>{tag}</a>)}
        </div>
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
