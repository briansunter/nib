import { siteHref, type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { PageHero } from '../../components/PageHero'
import RecipeFilter from '../../islands/recipe-filter'
import {
  categoryIcon,
  isMainRecipeCategory,
  primaryRecipeCategory,
  servingsLabel,
} from '../../lib/recipes'

export const meta = {
  title: 'Recipes',
  description: 'A collection of recipes for home cooking',
}

export default function RecipesPage({ collections }: PageProps<typeof config>) {
  const recipes = collections.recipes
    .map((entry) => entry.data)
    .sort((a, b) => a.slug.localeCompare(b.slug))
  const counts = new Map<string, number>()
  for (const recipe of recipes) {
    for (const rawTag of recipe.metadata.tags) {
      const tag = rawTag.trim().toLowerCase()
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  const popular = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([value, count]) => ({ value, count }))
  const categories = popular.filter((option) => isMainRecipeCategory(option.value))
  const tags = popular.filter((option) => !isMainRecipeCategory(option.value))

  return (
    <div className="py-16 sm:py-20" data-pagefind-ignore>
      <PageHero title="Recipes" className="mb-12 sm:mb-14">
        A collection of recipes for home cooking.
        <span className="mt-2 block font-sans text-base md:text-lg">
          <span className="font-semibold text-ink tabular-nums">{recipes.length}</span> recipes.
        </span>
      </PageHero>
      <section className="space-y-6 sm:space-y-8" data-recipe-list>
        <RecipeFilter
          categories={categories}
          tags={tags}
          listId="recipe-list"
          total={recipes.length}
          hydrate="load"
        />
        <div className="recipe-list" data-recipe-grid id="recipe-list">
          {recipes.map((recipe) => {
            const normalizedTags = recipe.metadata.tags.map((tag) => tag.trim().toLowerCase())
            const ingredients = recipe.ingredients.map(({ name }) => name)
            const primaryTag = primaryRecipeCategory(recipe.metadata.tags)
            const icon = primaryTag ? categoryIcon(primaryTag) : null
            const serving = servingsLabel(recipe.metadata.servings)
            const search = [
              recipe.metadata.title,
              recipe.metadata.description,
              recipe.metadata.tags.join(' '),
              ingredients.join(' '),
            ].join(' ').toLowerCase()
            return (
              <article
                className="recipe-list-item"
                data-recipe-card
                data-search={search}
                data-tags={normalizedTags.join(',')}
                key={recipe.slug}
              >
                <a
                  href={siteHref(`/recipes/${recipe.slug}`)}
                  data-astro-prefetch="hover"
                  data-recipe-card-link
                  data-recipe-slug={recipe.slug}
                  className="card-link recipe-list-link"
                >
                  <div className="recipe-list-copy">
                    <h2 className="recipe-list-title">{recipe.metadata.title}</h2>
                    {recipe.metadata.description && <p className="dek recipe-list-description">{recipe.metadata.description}</p>}
                    {ingredients.length > 0 && <p className="recipe-list-ingredients">{ingredients.join(', ')}</p>}
                  </div>
                  <div className="recipe-list-meta">
                    {primaryTag && (
                      <span className="recipe-list-category">
                        {icon && (
                          <svg
                            aria-hidden="true"
                            className="recipe-list-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            dangerouslySetInnerHTML={{ __html: icon }}
                          />
                        )}
                        {primaryTag}
                      </span>
                    )}
                    {' '}
                    {ingredients.length > 0 && <span><strong>{ingredients.length}</strong> ingredients</span>}
                    {' '}
                    {serving && <span>{serving}</span>}
                  </div>
                </a>
              </article>
            )
          })}
        </div>
        <div className="py-16 text-center font-sans sm:py-12" data-recipe-empty hidden>
          <svg className="mx-auto mb-4 h-14 w-14 text-ink-muted sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <p className="text-xl font-semibold text-ink-secondary sm:text-lg">No recipes found</p>
          <p className="mt-2 text-base text-ink-muted sm:text-sm">Try adjusting your search or filters.</p>
        </div>
      </section>
    </div>
  )
}
