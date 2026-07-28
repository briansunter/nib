import type { Recipe } from '../content'
import {
  isMetricUnit,
  normalizeUnit,
} from '../utils/recipeUnitConversion'

export { isMetricUnit, normalizeUnit }

export const MAIN_RECIPE_CATEGORIES = [
  'bread', 'main', 'side', 'breakfast', 'dessert', 'drink', 'sauce', 'snack',
] as const

export const RECIPE_CATEGORY_ICON_PATHS: Record<string, string> = {
  breakfast: '<circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />',
  sauce: '<path d="M8 2h8l2 4v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6l2-4z" /><path d="M10 6v4m4-4v4" />',
  bread: '<ellipse cx="12" cy="12" rx="9" ry="6" /><path d="M3 12v4c0 2 4 4 9 4s9-2 9-4v-4" />',
  main: '<circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" />',
  side: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path d="M12 6v6l4 2" />',
  dessert: '<path d="M4 16h16v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z" /><path d="M12 4c-4 0-6 4-6 8h12c0-4-2-8-6-8z" />',
  drink: '<path d="M17 8h1a4 4 0 010 8h-1" /><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />',
  snack: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" />',
}

export function isMainRecipeCategory(tag: string): boolean {
  return (MAIN_RECIPE_CATEGORIES as readonly string[]).includes(tag.toLowerCase())
}

export function primaryRecipeCategory(tags: readonly string[] | undefined): string | null {
  return tags?.find(isMainRecipeCategory) ?? null
}

export function categoryIcon(tag: string): string | null {
  return RECIPE_CATEGORY_ICON_PATHS[tag.toLowerCase()] ?? null
}

export function formatQuantity(value: number | string | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function meaningfulQuantity(value: number | string | undefined): boolean {
  if (value == null || value === '' || value === 1 || value === '1') return false
  return true
}

export function formatIngredientQuantity(value: number | string | undefined, units: string): string {
  if (units) return meaningfulQuantity(value) ? `${formatQuantity(value)} ${units}` : `1 ${units}`
  return meaningfulQuantity(value) ? formatQuantity(value) : ''
}

export function servingsLabel(servings: string | undefined): string | null {
  if (!servings) return null
  const value = String(servings).replace(/\s*(servings?|portions?)/i, '').trim()
  return `${value} ${value === '1' ? 'serving' : 'servings'}`
}

export function combineIngredients(ingredients: Recipe['ingredients']): Recipe['ingredients'] {
  return ingredients.reduce<Recipe['ingredients']>((result, ingredient) => {
    const existing = result.find((entry) => entry.name === ingredient.name && entry.units === ingredient.units)
    if (!existing) {
      result.push({ ...ingredient })
      return result
    }
    const left = typeof existing.quantity === 'number' ? existing.quantity : Number.parseFloat(existing.quantity) || 0
    const right = typeof ingredient.quantity === 'number' ? ingredient.quantity : Number.parseFloat(ingredient.quantity) || 0
    existing.quantity = left + right
    return result
  }, [])
}

export function combineCookwares(cookwares: Recipe['cookwares']): Recipe['cookwares'] {
  return cookwares.reduce<Recipe['cookwares']>((result, cookware) => {
    if (!result.some((entry) => entry.name === cookware.name)) result.push({ ...cookware })
    return result
  }, [])
}

export function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

export function safeHost(value: string | undefined): string | undefined {
  const safe = safeHttpUrl(value)
  return safe ? new URL(safe).hostname.replace(/^www\./, '') : undefined
}

export function formatDuration(value: string | undefined): string | undefined {
  if (!value) return undefined
  const raw = value.trim()
  if (/^\d+$/.test(raw)) return `PT${raw}M`
  if (raw.toUpperCase().startsWith('PT')) return raw.toUpperCase().replace(/\s/g, '')
  const hours = Number.parseInt(raw.match(/(\d+)\s*h(?:ours?)?/i)?.[1] ?? '0', 10)
  const minutes = Number.parseInt(raw.match(/(\d+)\s*m(?:in(?:utes?)?)?/i)?.[1] ?? '0', 10)
  if (!hours && !minutes) {
    const parsed = Number.parseInt(raw, 10)
    return Number.isNaN(parsed) ? undefined : `PT${parsed}M`
  }
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}`
}

function durationToMinutes(value: string): number {
  const hours = value.match(/(\d+)H/)?.[1]
  const minutes = value.match(/(\d+)M/)?.[1]
  return (
    (hours ? Number.parseInt(hours, 10) * 60 : 0)
    + (minutes ? Number.parseInt(minutes, 10) : 0)
  )
}

function minutesToDuration(total: number): string | undefined {
  if (total < 0) return undefined
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `PT${hours ? `${hours}H` : ''}${minutes || !hours ? `${minutes}M` : ''}`
}

export function sumIsoDurations(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  if (!left && !right) return undefined
  if (!left) return right
  if (!right) return left
  return minutesToDuration(durationToMinutes(left) + durationToMinutes(right))
}

export function subtractIsoDuration(
  total: string | undefined,
  prep: string | undefined,
): string | undefined {
  if (!total) return undefined
  if (!prep) return total
  const difference = durationToMinutes(total) - durationToMinutes(prep)
  return difference > 0 ? minutesToDuration(difference) : undefined
}

export function inferCookTime(steps: Recipe['steps']): string | undefined {
  let minutes = 0
  for (const step of steps) {
    for (const item of step) {
      if (item.type !== 'timer') continue
      const value = typeof item.quantity === 'number' ? item.quantity : Number.parseFloat(item.quantity)
      if (!Number.isFinite(value)) continue
      const unit = item.units.toLowerCase()
      if (unit === 'hour' || unit === 'hours') minutes += value * 60
      else if (unit === 'second' || unit === 'seconds') minutes += value / 60
      else if (unit === 'minute' || unit === 'minutes') minutes += value
    }
  }
  if (minutes <= 0) return undefined
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (!hours && !rest) return undefined
  return `PT${hours ? `${hours}H` : ''}${rest ? `${rest}M` : ''}`
}

function metaValue(recipe: Recipe, key: string): string | undefined {
  const value = (recipe.metadata as Record<string, unknown>)[key]
  return value == null || value === '' ? undefined : String(value)
}

function servingCount(value: string | undefined): number | undefined {
  const match = value?.match(/\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : undefined
}

function perServing(value: string | undefined, servings: number | undefined): string | undefined {
  if (!value || !servings || servings <= 0) return undefined
  const match = value.match(/^([\d.]+)\s*(\D.*)?$/)
  if (!match) return undefined
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount)) return undefined
  const unit = (match[2] ?? '').trim()
  const each = amount / servings
  const rounded = each >= 10 ? Math.round(each) : Math.round(each * 10) / 10
  return unit ? `${rounded}${unit.startsWith('g') ? unit : ` ${unit}`}` : String(rounded)
}

export function recipePageData(recipe: Recipe) {
  const ingredients = combineIngredients(recipe.ingredients)
  const cookwares = combineCookwares(recipe.cookwares)
  const tags = recipe.metadata.tags
  const primaryTag = primaryRecipeCategory(tags)
  const prepTime = metaValue(recipe, 'prepTime')
  const cookTime = metaValue(recipe, 'cookTime')
  const totalTime = metaValue(recipe, 'totalTime') ?? metaValue(recipe, 'time')
  const prepTimeIso = formatDuration(prepTime)
  const totalTimeIso = formatDuration(totalTime)
  const resolvedCookTime = (
    formatDuration(cookTime)
    ?? inferCookTime(recipe.steps)
    ?? subtractIsoDuration(totalTimeIso, prepTimeIso)
  )
  const resolvedTotalTime = totalTimeIso ?? sumIsoDurations(prepTimeIso, resolvedCookTime)
  const source = metaValue(recipe, 'source')
  const servings = metaValue(recipe, 'servings')
  const servingsCount = servingCount(servings)
  const nutrition = {
    calories: metaValue(recipe, 'nutrition-calories'),
    protein: metaValue(recipe, 'nutrition-protein'),
    carbs: metaValue(recipe, 'nutrition-carbs'),
    fat: metaValue(recipe, 'nutrition-fat'),
    fiber: metaValue(recipe, 'nutrition-fiber'),
    note: metaValue(recipe, 'nutrition-note'),
  }
  const nutritionRows = [
    ['Calories', nutrition.calories],
    ['Protein', nutrition.protein],
    ['Carbs', nutrition.carbs],
    ['Fat', nutrition.fat],
    ['Fiber', nutrition.fiber],
  ].flatMap(([label, value]) => {
    if (!value) return []
    const each = perServing(value, servingsCount)
    return [{ label, value: each ?? value, total: each ? value : undefined }]
  })
  const defaultUnit: 'metric' | 'imperial' = isMetricUnit(ingredients[0]?.units ?? '') ? 'metric' : 'imperial'
  return {
    ingredients,
    cookwares,
    defaultUnit,
    hasStructuredTimes: Boolean(prepTime || cookTime),
    hasSingleTime: !prepTime && !cookTime && Boolean(totalTime),
    hasAnyTime: Boolean(prepTime || cookTime || totalTime),
    prepTime,
    cookTime,
    totalTime,
    source,
    sourceHref: safeHttpUrl(source),
    sourceHost: safeHost(source),
    longDescription: metaValue(recipe, 'longDescription'),
    servings,
    servingsCount,
    author: metaValue(recipe, 'author'),
    primaryTag,
    otherTags: tags.filter((tag) => tag.toLowerCase() !== primaryTag?.toLowerCase()),
    methodBlocks: recipe.blocks.length ? recipe.blocks : recipe.steps.map((items) => ({ type: 'step' as const, items })),
    nutrition,
    nutritionRows,
    hasNutrition: nutritionRows.length > 0,
    nutritionSummary: servingsCount
      ? `Estimates per serving (recipe yields ${servingsCount}).`
      : 'Estimated totals for the recipe.',
    resolvedCookTime,
    resolvedTotalTime,
  }
}
