import { siteHref, type DataPageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import RecipeScaler from './islands/recipe-scaler'
import { imageMap } from './data/images'
import type { Project, Recipe, TagPage } from './content'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export function ProjectDetailPage({ data }: DataPageProps<Project>) {
  const cover = data.coverFile ? imageMap[data.slug] : undefined
  return (
    <article className="project-detail content-column">
      <a className="back-link" href={siteHref('/projects')}>← All projects</a>
      <header className="article-header">
        <p className="eyebrow">Project / {data.date.getFullYear()}</p>
        <h1>{data.title}</h1>
        <p className="article-dek">{data.description}</p>
        <div className="meta-row">
          <time dateTime={data.date.toISOString()}>{formatDate(data.date)}</time>
          {data.tags.map((tag) => <a className="tag" href={siteHref(`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`)} key={tag}>{tag}</a>)}
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
      ) : data.cover ? (
        <div className="detail-cover">
          <img
            src={siteHref(data.cover)}
            alt={`Cover for ${data.title}`}
            loading="eager"
            decoding="async"
          />
        </div>
      ) : null}
      {data.bodyHtml ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
      ) : (
        <div className="prose">
          <p>{data.description}</p>
        </div>
      )}
      <div className="external-links">
        {data.projectUrl && <a href={data.projectUrl}>Open live project ↗</a>}
        {data.github && <a href={data.github}>View source on GitHub ↗</a>}
      </div>
    </article>
  )
}

export function RecipeDetailPage({ data }: DataPageProps<Recipe>) {
  const { metadata, ingredients, cookware, sections, sourceText } = data
  const baseServings = metadata.servings ?? 2
  const rawMetadata = metadata as typeof metadata & Record<string, unknown>
  const metadataText = (key: string) => {
    const value = rawMetadata[key]
    return value == null || value === '' ? undefined : String(value)
  }
  const longDescription = metadata.longDescription ?? metadataText('long_description')
  const prepTime = metadata.prepTime ?? metadataText('prep time') ?? metadataText('prep-time')
  const cookTime = metadata.cookTime ?? metadataText('cook time') ?? metadataText('cook-time')
  const totalTime = metadata.totalTime ?? metadataText('total time') ?? metadata.time
  const nutrition = [
    ['Calories', 'nutrition-calories'],
    ['Protein', 'nutrition-protein'],
    ['Carbs', 'nutrition-carbs'],
    ['Fat', 'nutrition-fat'],
    ['Fiber', 'nutrition-fiber'],
  ]
    .map(([label, key]) => ({ label, value: metadataText(key) }))
    .filter((entry): entry is { label: string; value: string } => Boolean(entry.value))
  return (
    <article className="recipe-page content-column">
      <a className="back-link" href={siteHref('/recipes')}>← All recipes</a>
      <header className="article-header">
        <p className="eyebrow">Recipe{metadata.cuisine ? ` / ${metadata.cuisine}` : ''}</p>
        <h1>{metadata.title}</h1>
        {metadata.description && <p className="article-dek">{metadata.description}</p>}
        {longDescription && <p className="small-note recipe-long-description">{longDescription}</p>}
        <div className="meta-row">
          {metadata.servings && <span>Serves {metadata.servings}</span>}
          {metadata.difficulty && <span className="tag">{metadata.difficulty}</span>}
          {cookTime && <span>{cookTime} cook</span>}
          {prepTime && <span>{prepTime} prep</span>}
          {totalTime && <span>{totalTime} total</span>}
          {metadata.author && <span>By {metadata.author}</span>}
          {metadata.rating && <span>★ {metadata.rating}</span>}
          {metadata.tags.map((tag) => <a className="tag" href={siteHref(`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`)} key={tag}>{tag}</a>)}
        </div>
      </header>
      {ingredients.length > 0 && (
        <RecipeScaler
          baseServings={baseServings}
          hydrate="visible"
          ingredients={ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: typeof ingredient.quantity === 'number' ? ingredient.quantity : null,
            unit: ingredient.unit ?? '',
            raw: ingredient.raw ?? '',
          }))}
        />
      )}
      {nutrition.length > 0 && (
        <section className="recipe-nutrition">
          <h2>Nutrition</h2>
          <div className="meta-row">{nutrition.map((entry) => <span className="tag" key={entry.label}>{entry.label}: {entry.value}</span>)}</div>
          {metadataText('nutrition-note') && <p className="small-note">{metadataText('nutrition-note')}</p>}
        </section>
      )}
      {cookware.length > 0 && (
        <section className="recipe-cookware">
          <h2>Cookware</h2>
          <div className="meta-row">{cookware.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
        </section>
      )}
      <div className="prose recipe-method">
        {sections.filter((section) => section.steps.some((step) => step.trim() !== '')).map((section, index) => (
          <section key={index}>
            {section.title && <h2>{section.title}</h2>}
            {section.steps.map((step, stepIndex) => (
              <p key={stepIndex}>{step}</p>
            ))}
          </section>
        ))}
      </div>
      {metadata.source && (
        <p className="recipe-source">
          Source: <a href={metadata.source} rel="nofollow noopener">{metadata.source}</a>
        </p>
      )}
      <details className="recipe-source-text">
        <summary>View original Cooklang source</summary>
        <pre>{sourceText.trim()}</pre>
      </details>
    </article>
  )
}

export function TagDetailPage({ data }: DataPageProps<TagPage>) {
  const groups = new Map<string, typeof data.entries>()
  for (const entry of data.entries) {
    const list = groups.get(entry.kind) ?? []
    list.push(entry)
    groups.set(entry.kind, list)
  }
  return (
    <div className="content-column tag-page">
      <a className="back-link" href={siteHref('/tags')}>← All tags</a>
      <p className="eyebrow">Tag</p>
      <h1>#{data.display}</h1>
      <p className="lead">{data.count} item{data.count === 1 ? '' : 's'} tagged {data.display}.</p>
      {[...groups.entries()].map(([kind, entries]) => (
        <section key={kind}>
          <h2>{kind}</h2>
          <div className="post-list">
            {entries.map((entry) => (
              <a href={siteHref(entry.href)} key={entry.href} className="search-result">
                <span className="eyebrow">{kind}</span>
                <strong>{entry.title}</strong>
                <span>{entry.description}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
