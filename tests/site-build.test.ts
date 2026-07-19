import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildSite } from '../src/framework/site'

const root = path.resolve('tests/fixtures/basic-site')
const output = path.join(root, 'dist')

afterAll(async () => {
  await fs.rm(output, { recursive: true, force: true })
})

describe('framework-owned site builds', () => {
  it('prerenders a consumer project without consumer-owned framework files', async () => {
    await buildSite({ root })

    const home = await fs.readFile(path.join(output, 'client/index.html'), 'utf8')
    const about = await fs.readFile(path.join(output, 'client/about/index.html'), 'utf8')
    const team = await fs.readFile(path.join(output, 'client/team/index.html'), 'utf8')
    const pencil = await fs.readFile(
      path.join(output, 'client/products/pencil/index.html'),
      'utf8',
    )
    const notebook = await fs.readFile(
      path.join(output, 'client/products/notebook/index.html'),
      'utf8',
    )
    const notFound = await fs.readFile(path.join(output, 'client/404.html'), 'utf8')

    expect(home).toContain('<title>Home | Journal</title>')
    expect(home).toMatch(/<link rel="stylesheet" href="\/journal\/assets\/[^"]+\.css" \/>/)
    expect(home).toContain('data-site="Journal"')
    expect(home).toContain('data-island="counter"')
    expect(home).toContain('Count:')
    expect(home).toContain('>2</button>')
    expect(home).toContain('First typed post')
    expect(home).toContain('2026-07-18T00:00:00.000Z')
    expect(home).toContain('/journal/assets/')
    expect(about).toContain('<h1>About the journal</h1>')
    expect(about).toContain('<section data-eyebrow="Company">')
    expect(about).not.toContain('data-nib-islands')
    expect(team).toContain('<h1>Ada, Engineer</h1>')
    expect(pencil).toContain('<h1>Pencil</h1>')
    expect(pencil).toContain('<p>$2</p>')
    expect(notebook).toContain('<h1>Notebook</h1>')
    expect(notebook).toContain('<p>$7</p>')
    expect(notFound).toContain('Journal not found')
    await expect(fs.stat(path.join(root, 'src/framework'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  }, 30_000)
})
