import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import {
  ImageBuildRegistry,
  createImageSource,
  normalizeImagesOptions,
} from '../src/internal.ts'

const resultMarker = 'NIB_IMAGE_BENCHMARK_RESULT '
const workerIndex = process.argv.indexOf('--worker')

async function fingerprint(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
}

async function sourceFromFixture(fixture) {
  return createImageSource({
    __nibImage: true,
    __nibFile: fixture.file,
    __nibSourceId: crypto.createHash('sha256').update(fixture.file).digest('hex').slice(0, 24),
    __nibStem: fixture.name,
    width: fixture.width,
    height: fixture.height,
    format: fixture.format,
    hasAlpha: fixture.hasAlpha,
    animated: false,
    fingerprint: await fingerprint(fixture.file),
  })
}

function registerFixtureRequests(registry, options, fixtures, formats) {
  for (const fixture of fixtures) {
    const source = fixture.source
    const widths = [...new Set(
      [...options.widths.filter((width) => width <= source.width), source.width]
        .filter((width) => width <= 1920),
    )]
    const fallback = source.hasAlpha ? 'png' : 'jpeg'
    for (const width of widths) {
      for (const format of [...formats, fallback]) {
        registry.register(source, width, format, options.quality[format])
      }
    }
  }
}

async function outputBytes(directory) {
  const totals = {}
  const files = await fs.readdir(path.join(directory, 'assets/nib'))
  for (const file of files) {
    const extension = path.extname(file).slice(1)
    const stat = await fs.stat(path.join(directory, 'assets/nib', file))
    totals[extension] = (totals[extension] ?? 0) + stat.size
  }
  return totals
}

async function runWorker(root, scenario, concurrency, formatName) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'fixtures.json'), 'utf8'))
  const fixtures = await Promise.all(manifest.map(async (fixture) => ({
    ...fixture,
    source: await sourceFromFixture(fixture),
  })))
  const formats = formatName === 'webp' ? ['webp'] : ['avif', 'webp']
  const scenarioRoot = path.join(root, scenario)
  const options = normalizeImagesOptions(scenarioRoot, {
    widths: [480, 960, 1440, 1920],
    formats,
    concurrency: Number(concurrency),
  })
  let peakRss = process.memoryUsage().rss
  const baselineRss = peakRss
  const sample = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }, 5)

  const run = async (name) => {
    const registry = new ImageBuildRegistry(options, '/', 'production')
    registerFixtureRequests(registry, options, fixtures, formats)
    const started = performance.now()
    const output = path.join(scenarioRoot, `dist-${name}`)
    await registry.finalize(output)
    return {
      elapsedMs: Math.round(performance.now() - started),
      output,
      stats: { ...registry.stats() },
    }
  }

  const cold = await run('cold')
  const warm = await run('warm')
  clearInterval(sample)
  const bytes = await outputBytes(cold.output)
  const result = {
    scenario,
    concurrency: options.concurrency,
    formats: formatName,
    coldMs: cold.elapsedMs,
    warmMs: warm.elapsedMs,
    transforms: cold.stats.coldTransforms,
    transformsPerSecond: Number(
      (cold.stats.coldTransforms / (cold.elapsedMs / 1000)).toFixed(2),
    ),
    cacheHits: warm.stats.cacheHits,
    peakTransforms: cold.stats.peakTransforms,
    peakRssMb: Math.round(peakRss / 1024 / 1024),
    rssIncreaseMb: Math.round((peakRss - baselineRss) / 1024 / 1024),
    outputBytes: bytes,
    totalOutputBytes: Object.values(bytes).reduce((total, value) => total + value, 0),
  }
  console.log(`${resultMarker}${JSON.stringify(result)}`)
}

async function createFixtures(root) {
  const definitions = [
    { name: 'opaque-1mp', width: 1280, height: 800, format: 'jpeg', hasAlpha: false },
    { name: 'opaque-4mp', width: 2400, height: 1600, format: 'jpeg', hasAlpha: false },
    { name: 'opaque-12mp', width: 4000, height: 3000, format: 'jpeg', hasAlpha: false },
    { name: 'alpha-2mp', width: 1800, height: 1200, format: 'png', hasAlpha: true },
  ]
  const fixtures = []
  for (const definition of definitions) {
    const file = path.join(root, `${definition.name}.${definition.format}`)
    const input = sharp({
      create: {
        width: definition.width,
        height: definition.height,
        channels: 3,
        noise: { type: 'gaussian', mean: 128, sigma: 36 },
      },
    })
    if (definition.hasAlpha) {
      await input.ensureAlpha(0.72).png({ compressionLevel: 3 }).toFile(file)
    } else {
      await input.jpeg({ quality: 90 }).toFile(file)
    }
    fixtures.push({ ...definition, file })
  }
  await fs.writeFile(path.join(root, 'fixtures.json'), JSON.stringify(fixtures))
}

async function executeScenario(root, concurrency, formats) {
  const scenario = `${formats}-c${concurrency}`
  const child = spawn(process.execPath, [
    path.resolve(import.meta.dirname, 'benchmark.mjs'),
    '--worker',
    root,
    scenario,
    String(concurrency),
    formats,
  ], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', resolve)
  })
  if (code !== 0) {
    throw new Error(`Image benchmark ${scenario} failed (${code})\n${stdout}\n${stderr}`)
  }
  const marker = stdout.split('\n').find((line) => line.startsWith(resultMarker))
  if (!marker) throw new Error(`Image benchmark ${scenario} returned no result\n${stdout}`)
  return JSON.parse(marker.slice(resultMarker.length))
}

if (workerIndex !== -1) {
  await runWorker(...process.argv.slice(workerIndex + 1, workerIndex + 5))
} else {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-benchmark-'))
  try {
    console.info('Generating 1 MP, 2 MP alpha, 4 MP, and 12 MP benchmark sources...')
    await createFixtures(root)
    const results = []
    for (const concurrency of [1, 2, 4]) {
      results.push(await executeScenario(root, concurrency, 'modern'))
    }
    results.push(await executeScenario(root, 4, 'webp'))
    console.table(Object.fromEntries(results.map((result) => [
      result.scenario,
      {
        coldMs: result.coldMs,
        warmMs: result.warmMs,
        transformsPerSecond: result.transformsPerSecond,
        peakTransforms: result.peakTransforms,
        peakRssMb: result.peakRssMb,
        rssIncreaseMb: result.rssIncreaseMb,
        outputMb: Number((result.totalOutputBytes / 1024 / 1024).toFixed(2)),
      },
    ])))
    console.info(JSON.stringify({
      sharp: sharp.versions.sharp,
      vips: sharp.versions.vips,
      availableParallelism: os.availableParallelism(),
      uvThreadpoolSize: Number(process.env.UV_THREADPOOL_SIZE ?? 4),
      results,
    }, null, 2))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}
