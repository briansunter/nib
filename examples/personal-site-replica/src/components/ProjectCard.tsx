import { Image } from '@briansunter/nib-images'
import { siteHref } from '@briansunter/nib'
import type { Project } from '../content'
import { imageMap } from '../data/images'

export function ProjectCard({ project }: { project: Project }) {
  const cover = imageMap[project.cover]

  return (
    <article className="project-card">
      <a href={siteHref(`/projects/${project.slug}`)} className="project-card__link">
        <div className="project-card__media">
          {cover ? (
            <Image
              src={cover}
              alt={`Cover for ${project.title}`}
              layout="constrained"
              width={720}
              maxWidth={960}
              widths={[320, 480, 640, 720]}
              sizes="(min-width: 900px) 390px, 100vw"
              loading="lazy"
              className="cover-image"
            />
          ) : <span className="gradient-placeholder" aria-hidden="true" />}
        </div>
        <div className="project-card__body">
          <h3>{project.title}</h3>
          <p>{project.description}</p>
          <div className="meta-row">
            <time dateTime={project.date.toISOString()}>{project.date.getFullYear()}</time>
            {project.tags.slice(0, 4).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>
      </a>
    </article>
  )
}
