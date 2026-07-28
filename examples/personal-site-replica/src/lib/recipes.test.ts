import { describe, expect, it } from 'vitest'
import type { Recipe } from '../content'
import {
  inferCookTime,
  recipePageData,
  subtractIsoDuration,
  sumIsoDurations,
} from './recipes'

function recipeWith(
  metadata: Partial<Recipe['metadata']>,
  steps: Recipe['steps'] = [],
): Recipe {
  return {
    slug: 'duration-test',
    metadata: {
      title: 'Duration Test',
      description: '',
      tags: [],
      ...metadata,
    },
    ingredients: [],
    cookwares: [],
    steps,
    blocks: [],
    cooklang: '',
  }
}

describe('recipe duration parity', () => {
  it('derives missing cook time from total minus prep', () => {
    const page = recipePageData(recipeWith({
      prepTime: '10 minutes',
      totalTime: '45 minutes',
    }))

    expect(page.resolvedCookTime).toBe('PT35M')
    expect(page.resolvedTotalTime).toBe('PT45M')
  })

  it('derives missing total time from prep plus cook', () => {
    const page = recipePageData(recipeWith({
      prepTime: '10 minutes',
      cookTime: '20 minutes',
    }))

    expect(page.resolvedCookTime).toBe('PT20M')
    expect(page.resolvedTotalTime).toBe('PT30M')
  })

  it('prefers timer inference and ignores unsupported timer units', () => {
    const page = recipePageData(recipeWith(
      { prepTime: '10 minutes', totalTime: '45 minutes' },
      [[
        { type: 'timer', quantity: 30, units: 'minutes' },
        { type: 'timer', quantity: 4, units: 'days' },
      ]],
    ))

    expect(page.resolvedCookTime).toBe('PT30M')
    expect(page.resolvedTotalTime).toBe('PT45M')
    expect(inferCookTime([[
      { type: 'timer', quantity: 20, units: 'seconds' },
    ]])).toBeUndefined()
  })

  it('sums and subtracts ISO durations with source-compatible bounds', () => {
    expect(sumIsoDurations('PT1H', 'PT15M')).toBe('PT1H15M')
    expect(subtractIsoDuration('PT45M', 'PT10M')).toBe('PT35M')
    expect(subtractIsoDuration('PT10M', 'PT10M')).toBeUndefined()
  })
})
