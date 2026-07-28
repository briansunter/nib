import { siteHref } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type { Project } from '../content'
import { imageMap } from '../data/images'
import { randomGradient } from '../lib/randomGradient'
import { stripPageSuffix } from '../lib/content-queries'
import { formatDisplayDate } from '../lib/date'

export function ProjectCard({
  project,
  eager = false,
  analyticsSection = 'projects',
}: {
  project: Project
  eager?: boolean
  analyticsSection?: string
}) {
  const allTags = project.tags
    .map(stripPageSuffix)
    .filter((tag) => !['project', 'project-page'].includes(tag.toLowerCase()))
  const visibleTags = allTags.slice(0, 4)
  const cover = imageMap[project.slug]
  return (
    <article
      className="project-card group"
      data-project-card
      data-project-tags={allTags.map((tag) => tag.toLocaleLowerCase()).join('|')}
    >
      <a
        href={siteHref(`/projects/${project.slug}`)}
        data-nib-prefetch="tap"
        data-umami-event="project_card_click"
        data-umami-event-section={analyticsSection}
        data-umami-event-slug={project.slug}
        className="card-link flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated transition-colors duration-200 hover:border-ink-muted md:flex-row"
      >
        <div className="aspect-card flex items-center justify-center overflow-hidden bg-surface-subtle p-2 sm:p-4 md:w-[44%] md:flex-shrink-0 md:p-6">
          {cover ? (
            <Image
              src={cover}
              alt={`Cover for ${project.title}`}
              layout="constrained"
              width={960}
              maxWidth={960}
              widths={[400, 600, 960]}
              sizes="(min-width: 768px) 480px, 100vw"
              loading={eager ? 'eager' : 'lazy'}
              className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div
              style={{ background: randomGradient(project.slug) }}
              className="flex h-full w-full items-center justify-center rounded-lg"
            >
              <svg className="h-12 w-12 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4 p-5 sm:p-6 md:p-10">
          <h3 className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">{project.title}</h3>
          {project.description && <p className="dek line-clamp-4 text-base md:text-lg lg:text-xl">{project.description}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            <time className="font-sans" dateTime={project.date.toISOString()}>
              {formatDisplayDate(project.date)}
            </time>
            {(project.projectUrl || project.github) && (
              <div className="flex flex-wrap items-center gap-2">
                {project.projectUrl && (
                  <span className="proj-badge inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors group-hover:text-accent-hover">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Live
                  </span>
                )}
                {project.github && (
                  <span className="proj-badge inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors group-hover:text-accent-hover">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                    </svg>
                    GitHub
                  </span>
                )}
              </div>
            )}
            {visibleTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {visibleTags.map((tag) => <span className="proj-tag tag-mono text-xs text-ink-secondary" key={tag}>{tag}</span>)}
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  )
}
