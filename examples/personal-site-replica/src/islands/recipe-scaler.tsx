import { defineIsland } from '@briansunter/nib'
import { useState } from 'react'

interface Ingredient {
  name: string
  quantity: number
  unit: string
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
            {[2, 4, 6, 8].map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <ul>
        {ingredients.map((ingredient) => (
          <li key={ingredient.name}>
            <span>{ingredient.name}</span>
            <strong>{Number((ingredient.quantity * multiplier).toFixed(1))} {ingredient.unit}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default defineIsland('recipe-scaler', RecipeScalerComponent)
