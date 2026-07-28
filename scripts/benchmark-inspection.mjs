import { performance } from 'node:perf_hooks'
import path from 'node:path'
import { inspectSite } from '../dist/framework/verify.js'

const root = path.resolve(process.argv[2] ?? 'examples/blog')
const baselineMilliseconds = Number(process.env.INSPECTION_BASELINE_MS ?? 2520)
const minimumSpeedup = Number(process.env.INSPECTION_MIN_SPEEDUP ?? 3)
const samples = []

for (let run = 0; run < 9; run += 1) {
  if (typeof global.gc !== 'function') {
    throw new Error('Inspection benchmark requires Node --expose-gc')
  }
  global.gc()
  const started = performance.now()
  const inspection = await inspectSite({ root })
  const elapsed = performance.now() - started
  if (inspection.issues.some((issue) => issue.severity === 'error')) {
    throw new Error(`Cannot benchmark an invalid publication (${inspection.issues.length} issue(s))`)
  }
  if (run >= 2) samples.push(elapsed)
}

samples.sort((left, right) => left - right)
const medianMilliseconds = samples[Math.floor(samples.length / 2)]
const speedup = baselineMilliseconds / medianMilliseconds
console.log(JSON.stringify({
  root: path.relative(process.cwd(), root) || '.',
  baselineMilliseconds,
  samples: samples.map((value) => Math.round(value * 10) / 10),
  medianMilliseconds: Math.round(medianMilliseconds * 10) / 10,
  speedup: Math.round(speedup * 100) / 100,
}, null, 2))

if (speedup < minimumSpeedup) {
  throw new Error(`Warm inspection speedup ${speedup.toFixed(2)}x is below ${minimumSpeedup.toFixed(2)}x`)
}
