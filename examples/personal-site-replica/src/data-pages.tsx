import { siteHref, type DataPageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type { Project } from './content'
import { imageMap } from './data/images'

export function ProjectDetailPage({ data }: DataPageProps<Project>) {
  const cover = imageMap[data.cover]
  return (
    <article className="project-detail content-column">
      <a className="back-link" href={siteHref('/projects')}>← All projects</a>
      <header className="article-header">
        <p className="eyebrow">Project / {data.date.getFullYear()}</p>
        <h1>{data.title}</h1>
        <p className="article-dek">{data.description}</p>
        <div className="meta-row">
          {data.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
        </div>
      </header>
      {cover ? (
        <div className="detail-cover">
          <Image
            src={cover}
            alt={`Cover for ${data.title}`}
            layout="constrained"
            width={960}
            maxWidth={1280}
            widths={[480, 720, 960, 1280]}
            sizes="(min-width: 900px) 860px, 100vw"
            priority
          />
        </div>
      ) : (
        <div className="detail-cover detail-cover--placeholder" aria-label={`${data.title} cover image placeholder`}>
          <span>{data.cover}</span>
        </div>
      )}
      <div className="prose">
        <h2>Why it exists</h2>
        <p>{data.description} This small replica keeps the project page static while leaving the live project and source links available to readers.</p>
        <h2>What the page proves</h2>
        <ul>
          <li>typed YAML data becomes a route through a Nib page source</li>
          <li>the same project data feeds the index card and this detail page</li>
          <li>the project index cover is emitted as responsive AVIF, WebP, and fallback HTML</li>
        </ul>
        <div className="external-links">
          {data.projectUrl && <a href={data.projectUrl}>Open live project ↗</a>}
          {data.github && <a href={data.github}>View source on GitHub ↗</a>}
        </div>
      </div>
    </article>
  )
}
