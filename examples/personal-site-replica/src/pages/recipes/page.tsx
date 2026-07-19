import { siteHref } from '@briansunter/nib'
import RecipeScaler from '../../islands/recipe-scaler'

export const meta = {
  title: 'Recipes',
  description: 'Plain-text recipes with a small interactive serving scaler.',
}

export default function RecipesPage() {
  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Kitchen notes</p>
        <h1>Recipes</h1>
        <p className="lead">The target site’s Cooklang collection is a substantial custom loader. This small recipe proves the reader-facing shape and a browser-only serving control.</p>
      </header>
      <article className="recipe-page content-column">
        <a className="back-link" href={siteHref('/projects')}>A recipe project, in miniature ↗</a>
        <h2>Weeknight tomato pasta</h2>
        <p className="article-dek">A fast sauce with enough acidity and heat to hold up to a generous handful of greens.</p>
        <RecipeScaler
          baseServings={2}
          hydrate="visible"
          ingredients={[
            { name: 'Pasta', quantity: 180, unit: 'g' },
            { name: 'Cherry tomatoes', quantity: 250, unit: 'g' },
            { name: 'Olive oil', quantity: 2, unit: 'tbsp' },
            { name: 'Garlic cloves', quantity: 2, unit: '' },
            { name: 'Parmesan', quantity: 35, unit: 'g' },
          ]}
        />
        <div className="prose">
          <h3>Method</h3>
          <ol>
            <li>Boil the pasta in well-salted water. Reserve a mug of cooking water.</li>
            <li>Warm the oil, soften the garlic, then add the tomatoes until they begin to collapse.</li>
            <li>Toss pasta through the sauce with enough cooking water to make it glossy.</li>
            <li>Finish with Parmesan, black pepper, and whatever greens need using.</li>
          </ol>
        </div>
      </article>
    </div>
  )
}
