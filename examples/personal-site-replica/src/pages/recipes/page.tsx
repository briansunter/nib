import { siteHref, type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import RecipeFilter from '../../islands/recipe-filter'
import { SectionHeading } from '../../components/SectionHeading'

export const meta = {
  title: 'Recipes',
  description: 'A collection of plain-text Cooklang recipes for home cooking.',
}

export default function RecipesPage({ collections }: PageProps<typeof config>) {
  const recipes = [...collections.recipes].map((entry) => entry.data)
  const tagCounts = new Map<string, number>()
  for (const recipe of recipes) for (const tag of recipe.metadata.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  const categoryNames = ['bread', 'main', 'side', 'breakfast', 'sauce', 'dessert']
  const categories = categoryNames
    .filter((value) => tagCounts.has(value))
    .map((value) => ({ value, count: tagCounts.get(value) ?? 0 }))
  const tags = [...tagCounts.entries()]
    .filter(([value]) => !categoryNames.includes(value))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 9)
    .map(([value, count]) => ({ value, count }))

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Kitchen notes</p>
        <h1>Recipes</h1>
        <p className="lead">A Cooklang collection parsed at build time. Each recipe has its own route, a browser-only serving scaler, and the original source text.</p>
        <p className="project-count">{recipes.length} recipes</p>
      </header>
      <section className="content-column">
        <SectionHeading title={`${recipes.length} recipes`} />
        <RecipeFilter categories={categories} tags={tags} listId="recipe-list" hydrate="load" />
        <ul className="recipe-grid" id="recipe-list" aria-label="All recipes">
          {recipes.map((recipe) => {
            const search = `${recipe.metadata.title} ${recipe.metadata.description} ${recipe.metadata.tags.join(' ')}`.toLowerCase()
            return (
              <li
                key={recipe.slug}
                data-recipe
                data-search={search}
                data-cuisine={recipe.metadata.cuisine ?? ''}
                data-tags={recipe.metadata.tags.join(',')}
                className="recipe-card"
              >
                <a href={siteHref(`/recipes/${recipe.slug}`)}>
                  <strong>{recipe.metadata.title}</strong>
                  {recipe.metadata.description && <span>{recipe.metadata.description}</span>}
                  <span className="meta-row">
                    {recipe.metadata.cuisine && <span className="tag">{recipe.metadata.cuisine}</span>}
                    {recipe.metadata.servings && <span>Serves {recipe.metadata.servings}</span>}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>
      <p className="small-note content-column">The static recipe list is server-rendered; the filter island only toggles visibility, so the full collection is never serialized into client JavaScript.</p>
    </div>
  )
}
