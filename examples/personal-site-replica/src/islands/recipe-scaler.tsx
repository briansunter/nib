import { defineIsland } from '@briansunter/nib'
import { useState } from 'react'

interface Ingredient {
  name: string
  quantity: number | null
  unit: string
  raw: string
}

function RecipeScalerComponent({ baseServings, ingredients }: { baseServings: number; ingredients: Ingredient[] }) {
  const [servings, setServings] = useState(baseServings)
  const multiplier = servings / baseServings

  return (
    <section className="recipe-scale" aria-labelledby="recipe-scale-title">
      <div className="recipe-scale__heading">
        <div>
          <p className="eyebrow">One small island</p>
          <h2 id="recipe-scale-title">Ingredients</h2>
        </div>
        <label>
          Servings
          <select value={servings} onChange={(event) => setServings(Number(event.target.value))}>
            {[baseServings, 2, 4, 6, 8]
              .filter((value, index, values) => values.indexOf(value) === index)
              .sort((a, b) => a - b)
              .map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <ul>
        {ingredients.map((ingredient, index) => (
          <li key={`${ingredient.name}-${index}`}>
            <span>{ingredient.name}</span>
            <strong>
              {ingredient.quantity == null
                ? ingredient.raw
                : `${Number((ingredient.quantity * multiplier).toFixed(2))} ${ingredient.unit}`.trim()}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default defineIsland('recipe-scaler', RecipeScalerComponent)
