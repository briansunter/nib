import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateRecipeTime,
  normalizeRecipeMetadata,
  rewriteWritingMarkdown,
} from './import-content.mjs'

test('preserves wikilinks in prose, inline code, and fenced code', () => {
  const source = [
    'Read [[issue-10|the full post]].',
    '',
    'Use `[[logseq-social/profile]]` as the page name.',
    '',
    '```clojure',
    '[[Morning Questions]]',
    '  [[What Am I Grateful for?]]',
    '```',
    '',
  ].join('\n')

  assert.equal(rewriteWritingMarkdown(source), source)
})

test('preserves every authored iframe attribute and raw query separator', () => {
  const iframe = '<iframe width="640" height="480" '
    + 'src="https://www.google.com/maps/d/embed?mid=route&hl=en&ehbc=2E312F" '
    + 'title="Travels with Charley route map" loading="lazy"></iframe>'

  assert.equal(rewriteWritingMarkdown(iframe), iframe)
})

test('continues to normalize local video and image assets', () => {
  const source = [
    '![demo](../../assets/videos/demo.mp4)',
    '![cover](../../assets/images/example.png)',
  ].join('\n')

  assert.equal(
    rewriteWritingMarkdown(source),
    [
      '![demo](/videos/demo.mp4)',
      '![cover](/site-assets/example.png)',
    ].join('\n'),
  )
})

test('matches source recipe metadata aliases without treating legacy time as explicit totalTime', () => {
  const metadata = normalizeRecipeMetadata({
    title: 'Legacy Recipe',
    tags: ['main'],
    time: '60 minutes',
    url: 'https://example.com/recipe',
    serves: 4,
    long_description: 'A long description.',
  }, 'legacy-recipe')

  assert.equal(metadata.time, '60 minutes')
  assert.equal(metadata.totalTime, undefined)
  assert.equal(metadata.source, 'https://example.com/recipe')
  assert.equal(metadata.servings, '4')
  assert.equal(metadata.longDescription, 'A long description.')
})

test('matches source timer-derived recipe duration formatting', () => {
  assert.equal(calculateRecipeTime([[
    { type: 'timer', quantity: 30, units: 'minutes' },
    { type: 'timer', quantity: '35-40', units: 'minutes' },
    { type: 'timer', quantity: 10, units: 'minutes' },
  ]]), '1h 15m')

  assert.equal(calculateRecipeTime([[
    { type: 'timer', quantity: 3, units: 'minutes' },
    { type: 'timer', quantity: '7-10', units: 'minutes' },
  ]]), '10 min')
})
