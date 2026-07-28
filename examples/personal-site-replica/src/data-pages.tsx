import { Content, siteHref, type DataPageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import { Fragment } from 'react'
import CopyButton from './islands/copy-button'
import { ContentEnhancements } from './client-behaviors'
import RecipeControls from './components/RecipeControls'
import { imageMap } from './data/images'
import type { Project, Recipe, TagPage } from './content'
import { PostListItem } from './components/BlogList'
import { PageFrame } from './components/PageFrame'
import { PageHero } from './components/PageHero'
import { SocialShare } from './components/SocialShare'
import { stripPageSuffix, titledPages } from './lib/content-queries'
import { highlightCooklang } from './lib/cooklang-highlight'
import { formatDisplayDate } from './lib/date'
import {
  categoryIcon,
  formatDuration,
  formatIngredientQuantity,
  recipePageData,
  servingsLabel,
} from './lib/recipes'

function SvgIcon({ path, className }: { path: string; className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  )
}

const ROCKET_PATH = 'm13.16 22.19l-1.66-3.84c1.6-.58 3.07-1.35 4.43-2.27l-2.78 6.11m-7.5-9.69l-3.84-1.65l6.11-2.78a20 20 0 0 0-2.27 4.43M21.66 2.35S23.78 7.31 18.11 13c-2.2 2.17-4.58 3.5-6.73 4.34c-.74.28-1.57.1-2.12-.46l-2.13-2.13c-.56-.56-.74-1.38-.47-2.13C7.5 10.5 8.83 8.09 11 5.89C16.69.216 21.66 2.35 21.66 2.35M6.25 22H4.84l4.09-4.1c.3.21.63.36.97.45zM2 22v-1.41l4.77-4.78l1.43 1.42L3.41 22zm0-2.84v-1.41l3.65-3.65c.09.35.24.68.45.97zM16 6a2 2 0 1 0 0 4c1.11 0 2-.89 2-2a2 2 0 0 0-2-2'
const EXTERNAL_PATH = 'M5 17.59L15.59 7H9V5h10v10h-2V8.41L6.41 19z'
const GITHUB_PATH = 'M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2'

export function ProjectDetailPage({ data, site }: DataPageProps<Project>) {
  const cover = imageMap[data.slug]
  const origin = (site.origin ?? 'https://briansunter.com').replace(/\/$/, '')
  const pageUrl = `${origin}/projects/${data.slug}`
  const projectTags = [...new Set([
    'project',
    ...data.tags.map(stripPageSuffix),
  ])]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': data.github ? 'SoftwareSourceCode' : data.projectUrl ? 'SoftwareApplication' : 'CreativeWork',
    '@id': `${pageUrl}#project`,
    name: data.title,
    description: data.description,
    url: data.projectUrl || pageUrl,
    mainEntityOfPage: pageUrl,
    image: data.cover ? new URL(data.cover, `${origin}/`).href : undefined,
    dateCreated: data.date.toISOString(),
    keywords: projectTags,
    codeRepository: data.github,
    author: {
      '@type': 'Person',
      '@id': `${origin}/#person`,
      name: 'Brian Sunter',
      url: origin,
    },
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mx-auto max-w-3xl px-3 pb-6 pt-8 lg:px-8 lg:pb-8 lg:pt-12">
        <div className="text-center">
          <div className="mb-4">
            <time className="font-sans text-sm text-ink-secondary" dateTime={data.date.toISOString()}>
              {formatDisplayDate(data.date)}
            </time>
          </div>
          <h1 className="font-sans text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl lg:text-5xl">{data.title}</h1>
          {data.description && (
            <p className="mx-auto mt-4 max-w-2xl font-serif text-lg leading-relaxed text-ink-secondary lg:text-xl">
              {data.description}
            </p>
          )}
          {(data.projectUrl || data.github) && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {data.projectUrl && (
                <a
                  href={data.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-umami-event="project_external_click"
                  data-umami-event-slug={`projects/${data.slug}`}
                  data-umami-event-target="live"
                  data-outbound-category="project"
                  className="project-btn-primary group inline-flex items-center gap-2.5 rounded-xl px-6 py-3 font-semibold transition-opacity duration-200 hover:opacity-85"
                >
                  <SvgIcon path={ROCKET_PATH} className="h-5 w-5" />
                  <span>Visit Project</span>
                  <SvgIcon path={EXTERNAL_PATH} className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              )}
              {data.github && (
                <a
                  href={data.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-umami-event="project_external_click"
                  data-umami-event-slug={`projects/${data.slug}`}
                  data-umami-event-target="github"
                  data-outbound-category="project"
                  className="project-btn-secondary group inline-flex items-center gap-2.5 rounded-xl border px-6 py-3 font-semibold transition-colors duration-200"
                >
                  <SvgIcon path={GITHUB_PATH} className="h-5 w-5" />
                  <span>View Source</span>
                  <SvgIcon path={EXTERNAL_PATH} className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              )}
            </div>
          )}
          {projectTags.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {projectTags.map((tag) => (
                <span className="proj-tag tag-mono text-sm text-ink-secondary" key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </header>
      {cover ? (
        <div className="mx-auto mb-12 max-w-6xl px-3 lg:px-8">
          <Image
            src={cover}
            alt={`Cover image for ${data.title}`}
            layout="constrained"
            width={1200}
            maxWidth={1200}
            widths={[400, 800, 1200]}
            sizes="(min-width: 1200px) 1152px, 100vw"
            priority
            className="max-h-[860px] h-auto w-full rounded-xl object-cover"
            data-pagefind-meta="image[src], image_alt[alt]"
          />
        </div>
      ) : data.cover ? (
        <div className="mx-auto mb-12 max-w-6xl px-3 lg:px-8">
          <img
            src={siteHref(data.cover)}
            alt={`Cover image for ${data.title}`}
            loading="eager"
            decoding="async"
            className="max-h-[860px] h-auto w-full rounded-xl object-cover"
          />
        </div>
      ) : null}
      <article className="mx-auto max-w-3xl px-3 lg:px-8" data-pagefind-body>
        {data.body.html ? (
          <Content body={data.body} as="div" className="prose-editorial" />
        ) : (
          <div className="prose-editorial">
            <p>{data.description}</p>
          </div>
        )}
      </article>
      <div className="mx-auto max-w-3xl px-3 pb-12 lg:px-8">
        <SocialShare slug={`projects/${data.slug}`} title={data.title} label="Share this project" />
      </div>
      <ContentEnhancements props={{}} hydrate="load" />
    </>
  )
}

export function RecipeDetailPage({ data }: DataPageProps<Recipe>) {
  const page = recipePageData(data)
  const { metadata } = data
  const inlineMeta = [
    page.servings ? { key: 'servings', label: servingsLabel(page.servings) } : null,
    page.author ? { key: 'author', label: page.author } : null,
  ].filter((item): item is { key: string; label: string } => Boolean(item?.label))
  const stepText = (step: Recipe['steps'][number]) => step.map((item) => {
    if (item.type === 'text') return item.value
    if (item.type === 'ingredient') return `${formatIngredientQuantity(item.quantity, item.units)} ${item.name}`.trim()
    if (item.type === 'timer') return `${item.quantity} ${item.units}`.trim()
    return item.name
  }).join(' ')
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: metadata.title,
    description: metadata.description,
    image: ['https://briansunter.com/kitchen.jpg'],
    recipeIngredient: data.ingredients.map((ingredient) => (
      `${formatIngredientQuantity(ingredient.quantity, ingredient.units)} ${ingredient.name}`.trim()
    )),
    recipeInstructions: data.steps.map((step, index) => ({
      '@type': 'HowToStep',
      name: `Step ${index + 1}`,
      url: `https://briansunter.com/recipes/${data.slug}#step-${index + 1}`,
      image: 'https://briansunter.com/kitchen.jpg',
      text: stepText(step),
    })),
    author: { '@type': 'Person', name: page.author ?? 'Brian Sunter' },
    keywords: metadata.tags.join(', '),
    recipeYield: page.servings,
    recipeCategory: metadata.course ?? page.primaryTag ?? undefined,
    tool: page.cookwares.map(({ name }) => ({ '@type': 'HowToTool', name })),
    prepTime: formatDuration(page.prepTime),
    cookTime: page.resolvedCookTime,
    totalTime: page.resolvedTotalTime,
    ...(page.sourceHref ? { isBasedOn: page.sourceHref } : {}),
  }
  let stepNumber = 0
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <PageFrame>
        <div className="mx-auto max-w-3xl px-3 py-12 sm:px-6 lg:px-8 lg:py-20" data-pagefind-body>
        <header className="mb-10">
          <h1 className="mb-6 font-sans text-4xl font-bold leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-6xl">{metadata.title}</h1>
          {metadata.description && <p className="dek text-xl leading-relaxed">{metadata.description}</p>}
          {page.source && (
            <p className="mt-3 font-sans text-sm text-ink-muted">
              via{' '}
              {page.sourceHref ? (
                <a
                  href={page.sourceHref}
                  rel="noopener noreferrer"
                  target="_blank"
                  data-outbound-category="recipe-source"
                  className="underline decoration-border underline-offset-2 transition-colors hover:text-ink hover:decoration-ink"
                >
                  {page.sourceHost ?? page.source}
                </a>
              ) : <span>{page.source}</span>}
            </p>
          )}
          <div className="mt-6 space-y-3 border-t border-border pt-6">
            {(page.hasAnyTime || inlineMeta.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm text-ink-secondary">
                {page.hasAnyTime && (
                  <svg className="mr-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                  </svg>
                )}
                {page.hasStructuredTimes && page.cookTime && (
                  <span><span className="font-semibold text-ink tabular-nums">{page.cookTime}</span> cook</span>
                )}
                {page.hasStructuredTimes && page.prepTime && (
                  <>
                    {page.cookTime && <span className="text-border" aria-hidden="true">·</span>}
                    <span><span className="font-medium text-ink tabular-nums">{page.prepTime}</span> prep</span>
                  </>
                )}
                {page.hasStructuredTimes && page.totalTime && (page.cookTime || page.prepTime) && (
                  <><span className="text-border" aria-hidden="true">·</span><span className="text-ink-muted tabular-nums">{page.totalTime} total</span></>
                )}
                {page.hasSingleTime && <span className="font-semibold text-ink tabular-nums">{page.totalTime}</span>}
                {inlineMeta.map((item, index) => (
                  <span className="contents" key={item.key}>
                    {(page.hasAnyTime || index > 0) && <span className="text-border" aria-hidden="true">·</span>}
                    {item.key === 'author'
                      ? <span>by <span className="font-medium text-ink">{item.label}</span></span>
                      : <span className="font-medium text-ink">{item.label}</span>}
                  </span>
                ))}
              </div>
            )}
            {(page.primaryTag || page.otherTags.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {page.primaryTag && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 py-1 font-sans text-xs font-bold uppercase tracking-wide text-ink">
                    {categoryIcon(page.primaryTag) && (
                      <svg
                        className="h-3 w-3 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        dangerouslySetInnerHTML={{ __html: categoryIcon(page.primaryTag) ?? '' }}
                      />
                    )}
                    {page.primaryTag}
                  </span>
                )}
                {page.otherTags.map((tag) => (
                  <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 font-sans text-xs text-ink-muted" key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </header>
        <div className="mb-12 mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
          <RecipeControls defaultUnit={page.defaultUnit} />
        </div>
        {page.hasNutrition && (
          <section className="mb-12 mt-8">
            <h2 className="mb-2 font-sans text-2xl font-semibold tracking-tight text-ink">Nutrition</h2>
            <p className="mb-6 font-sans text-sm text-ink-muted">{page.nutritionSummary}</p>
            <dl className="grid grid-cols-2 gap-4 font-sans sm:grid-cols-5">
              {page.nutritionRows.map((entry) => (
                <div className="rounded-lg border border-border-subtle px-4 py-3" key={entry.label}>
                  <dt className="text-xs uppercase tracking-widest text-ink-muted">{entry.label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink">{entry.value}</dd>
                  {entry.total && <dd className="mt-0.5 text-xs text-ink-muted">total {entry.total}</dd>}
                </div>
              ))}
            </dl>
            {page.nutrition.note && <p className="mt-4 font-serif text-sm italic text-ink-muted">{page.nutrition.note}</p>}
          </section>
        )}
        <section className="mb-16">
          <h2 className="mb-6 font-sans text-2xl font-semibold tracking-tight text-ink">Ingredients</h2>
          <ul className="space-y-4 font-sans" id="ingredients-list">
            {page.ingredients.map((ingredient, index) => {
              const display = formatIngredientQuantity(ingredient.quantity, ingredient.units) || '-'
              const hasDisplay = Boolean((ingredient.quantity !== 1 && ingredient.units) || ingredient.units)
              return (
                <li
                  data-original-quantity={ingredient.quantity}
                  data-original-units={ingredient.units}
                  data-has-display-quantity={String(hasDisplay)}
                  data-name={ingredient.name}
                  className="flex items-baseline gap-4 border-b border-border-subtle pb-4 text-lg text-ink"
                  key={`${ingredient.name}-${ingredient.units}-${index}`}
                >
                  <span className="quantity min-w-[5rem] font-sans text-base font-medium text-ink-secondary tabular-nums">{display}</span>{' '}
                  <span className="flex-1">{ingredient.name}</span>
                </li>
              )
            })}
          </ul>
        </section>
        {page.cookwares.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-4 font-sans text-2xl font-semibold tracking-tight text-ink">Equipment</h2>
            <ul className="list-disc space-y-2 pl-5 font-sans text-base text-ink">
              {page.cookwares.map((cookware) => <li className="marker:text-ink-muted" key={cookware.name}>{cookware.name}</li>)}
            </ul>
          </section>
        )}
        {page.longDescription && (
          <section className="mb-16">
            <h2 className="mb-4 font-sans text-2xl font-semibold tracking-tight text-ink">About</h2>
            <div className="space-y-4 font-serif text-lg leading-relaxed text-ink-secondary">
              {page.longDescription.split(/\n\n+/).map((paragraph) => <p key={paragraph}>{paragraph.trim()}</p>)}
            </div>
          </section>
        )}
        <section className="mb-16">
          <h2 className="mb-10 font-sans text-2xl font-semibold tracking-tight text-ink">Instructions</h2>
          <div className="space-y-10 md:space-y-12">
            {page.methodBlocks.map((block, blockIndex) => {
              if (block.type === 'section') {
                return <h3 className="recipe-section mt-2 font-sans text-xl font-semibold tracking-tight text-ink lg:text-2xl" key={`section-${blockIndex}`}>{block.name}</h3>
              }
              if (block.type === 'note') {
                return (
                  <aside className="recipe-note border-l-2 border-recipe-note py-1 pl-4 font-serif text-base italic leading-relaxed text-ink-secondary" key={`note-${blockIndex}`}>
                    <span className="mr-2 font-sans text-xs font-semibold not-italic uppercase tracking-widest text-recipe-note-label">Note</span>
                    {' '}{block.text}
                  </aside>
                )
              }
              stepNumber += 1
              return (
                <div className="recipe-step" id={`step-${stepNumber}`} key={`step-${blockIndex}`}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="font-sans text-base font-semibold text-ink-secondary tabular-nums md:text-lg">{stepNumber}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-ink lg:text-xl">
                    {block.items.map((item, itemIndex) => {
                      if (item.type === 'text') return <span className="inline" key={itemIndex}>{item.value}</span>
                      if (item.type === 'cookware') {
                        return (
                          <Fragment key={itemIndex}>
                            {' '}<span className="inline rounded-sm bg-recipe-cookware-bg pl-[1px] pr-[0.5px] font-semibold">{item.name}</span>{' '}
                          </Fragment>
                        )
                      }
                      if (item.type === 'timer') {
                        return (
                          <Fragment key={itemIndex}>
                            {' '}<span className="timer inline rounded-sm bg-recipe-timer-bg pl-[1px] pr-[0.5px] font-semibold" data-original-quantity={item.quantity} data-original-units={item.units}>
                              <span className="original-text">{item.quantity} {item.units}</span>
                              <span className="converted-text hidden" />
                            </span>{' '}
                          </Fragment>
                        )
                      }
                      const hasDisplay = Boolean((item.quantity !== 1 && item.units) || item.units)
                      return (
                        <Fragment key={itemIndex}>
                          {' '}<span
                            className="ingredient inline rounded-sm bg-recipe-ingredient-bg pl-[1px] pr-[0.5px] font-semibold"
                            data-original-quantity={item.quantity}
                            data-original-units={item.units}
                            data-has-display-quantity={String(hasDisplay)}
                            data-name={item.name}
                          >
                            <span className="original-text">{formatIngredientQuantity(item.quantity, item.units)} {item.name}</span>
                            <span className="converted-text hidden" />
                          </span>{' '}
                        </Fragment>
                      )
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
        <section className="mt-20 border-t border-border pt-12">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 text-ink-muted transition-colors hover:text-ink">
              <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-sans text-xs font-medium uppercase tracking-widest">View Cooklang Source</span>
            </summary>
            <div className="cooklang-code mt-6 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  <span className="font-sans text-xs font-medium uppercase tracking-wide text-ink-muted">recipe.cook</span>
                </div>
                <CopyButton value={data.cooklang} label="Copy" inline hydrate="visible" />
              </div>
              <div className="relative" dangerouslySetInnerHTML={{ __html: highlightCooklang(data.cooklang) }} />
            </div>
          </details>
        </section>
        </div>
      </PageFrame>
    </>
  )
}

export function TagDetailPage({ data }: DataPageProps<TagPage>) {
  const posts = titledPages(data.entries)
  return (
    <PageFrame>
      <div className="py-16 sm:py-20" data-pagefind-ignore>
        <PageHero
        titleNode={<span className="tag-mono">{data.display}</span>}
        before={(
          <a href={siteHref('/tags')} className="page-hero-back focus-accent">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All tags
          </a>
        )}
      >
        <span className="mt-2 block font-sans text-base md:text-lg">
          <span className="font-semibold text-ink tabular-nums">{posts.length}</span> posts.
        </span>
      </PageHero>
      <div className="post-list flex flex-col">
        {posts.map((post) => (
          <PostListItem
            post={post}
            analyticsSource="tag"
            headingTag="h2"
            key={post.slug}
          />
        ))}
        </div>
      </div>
    </PageFrame>
  )
}
