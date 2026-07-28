import fs from 'node:fs'
import path from 'node:path'
import { builtinModules } from 'node:module'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { frameworkPackageEntries, type PackageEntry } from '../package-entries'
import {
  imagePackageEntries,
  type ImagePackageEntry,
} from '../packages/nib-images/package-entries'

interface PackageJson {
  readonly exports: Readonly<Record<string, unknown>>
}

interface ExportTarget {
  readonly import: string
  readonly types: string
}

interface SourceImport {
  readonly specifier: string
  readonly runtime: boolean
}

type Entry = PackageEntry | ImagePackageEntry

const repositoryRoot = path.resolve('.')
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
])

function readPackageJson(file: string): PackageJson {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PackageJson
}

function isExportTarget(value: unknown): value is ExportTarget {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as { import?: unknown }).import === 'string'
    && typeof (value as { types?: unknown }).types === 'string'
}

function codeExports(packageJson: PackageJson): Readonly<Record<string, ExportTarget>> {
  return Object.fromEntries(
    Object.entries(packageJson.exports)
      .filter((entry): entry is [string, ExportTarget] => isExportTarget(entry[1])),
  )
}

function verifyEntryManifest(
  packageDirectory: string,
  entries: readonly Entry[],
): void {
  const packageJson = readPackageJson(path.join(packageDirectory, 'package.json'))
  const packageExports = codeExports(packageJson)
  const exportedEntries = entries.filter(
    (entry): entry is Entry & { readonly exportKey: string } => entry.exportKey !== undefined,
  )

  expect(exportedEntries.map((entry) => entry.exportKey).sort()).toEqual(
    Object.keys(packageExports).sort(),
  )

  for (const entry of entries) {
    expect(fs.existsSync(path.join(packageDirectory, entry.source)), entry.source).toBe(true)
    expect(fs.existsSync(path.join(packageDirectory, entry.javascript)), entry.javascript).toBe(true)
    expect(fs.existsSync(path.join(packageDirectory, entry.types)), entry.types).toBe(true)
    if (entry.exportKey === undefined) continue
    expect(packageExports[entry.exportKey]).toEqual({
      import: entry.javascript,
      types: entry.types,
    })
  }
}

function sourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(file))
    else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(file)
    }
  }
  return files
}

function importIsRuntime(declaration: ts.ImportDeclaration): boolean {
  const clause = declaration.importClause
  if (clause === undefined) return true
  if (clause.isTypeOnly) return false
  if (clause.name !== undefined) return true
  const bindings = clause.namedBindings
  if (bindings === undefined || ts.isNamespaceImport(bindings)) return true
  return bindings.elements.some((element) => !element.isTypeOnly)
}

function sourceImports(file: string): SourceImport[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const imports: SourceImport[] = []
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push({
        specifier: statement.moduleSpecifier.text,
        runtime: importIsRuntime(statement),
      })
    } else if (
      ts.isExportDeclaration(statement)
      && statement.moduleSpecifier !== undefined
      && ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      imports.push({
        specifier: statement.moduleSpecifier.text,
        runtime: !statement.isTypeOnly,
      })
    }
  }
  return imports
}

function resolveSourceImport(
  importer: string,
  specifier: string,
  files: ReadonlySet<string>,
): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const base = path.resolve(path.dirname(importer), specifier)
  return [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ].find((candidate) => files.has(candidate))
}

function runtimeGraph(directory: string): Map<string, readonly string[]> {
  const files = new Set(sourceFiles(directory).map((file) => path.resolve(file)))
  return new Map([...files].map((file) => [
    file,
    sourceImports(file)
      .filter((dependency) => dependency.runtime)
      .map((dependency) => resolveSourceImport(file, dependency.specifier, files))
      .filter((dependency): dependency is string => dependency !== undefined),
  ]))
}

function stronglyConnectedComponents(
  graph: ReadonlyMap<string, readonly string[]>,
): string[][] {
  let nextIndex = 0
  const stack: string[] = []
  const onStack = new Set<string>()
  const indexes = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const components: string[][] = []

  function visit(file: string): void {
    indexes.set(file, nextIndex)
    lowLinks.set(file, nextIndex)
    nextIndex += 1
    stack.push(file)
    onStack.add(file)

    for (const dependency of graph.get(file) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency)
        lowLinks.set(file, Math.min(
          lowLinks.get(file) ?? 0,
          lowLinks.get(dependency) ?? 0,
        ))
      } else if (onStack.has(dependency)) {
        lowLinks.set(file, Math.min(
          lowLinks.get(file) ?? 0,
          indexes.get(dependency) ?? 0,
        ))
      }
    }

    if (lowLinks.get(file) !== indexes.get(file)) return
    const component: string[] = []
    let dependency: string
    do {
      dependency = stack.pop() as string
      onStack.delete(dependency)
      component.push(dependency)
    } while (dependency !== file)
    components.push(component)
  }

  for (const file of graph.keys()) {
    if (!indexes.has(file)) visit(file)
  }
  return components
}

function transitiveFiles(
  graph: ReadonlyMap<string, readonly string[]>,
  entry: string,
): readonly string[] {
  const files = new Set<string>()
  const pending = [path.resolve(entry)]
  while (pending.length > 0) {
    const file = pending.pop() as string
    if (files.has(file)) continue
    files.add(file)
    pending.push(...graph.get(file) ?? [])
  }
  return [...files]
}

describe('repository architecture', () => {
  it('keeps package exports, build entries, declarations, and output aligned', () => {
    verifyEntryManifest(repositoryRoot, frameworkPackageEntries)
    verifyEntryManifest(path.join(repositoryRoot, 'packages/nib-images'), imagePackageEntries)
  })

  it('has no runtime import cycles in framework source', () => {
    const graph = runtimeGraph(path.join(repositoryRoot, 'src'))
    const cycles = stronglyConnectedComponents(graph)
      .filter((component) => component.length > 1)
      .map((component) => component.map((file) => path.relative(repositoryRoot, file)).sort())
    expect(cycles).toEqual([])
  })

  it('keeps foundational contracts independent from plugin execution', () => {
    const foundational = [
      'src/framework/types.ts',
      'src/framework/extensions/contracts.ts',
      'src/framework/content/page-sources.ts',
    ]
    for (const file of foundational) {
      const imports = sourceImports(path.join(repositoryRoot, file))
        .map((dependency) => dependency.specifier)
      expect(imports, file).not.toContain('./host')
      expect(imports, file).not.toContain('../extensions/host')
      expect(imports, file).not.toContain('./extensions/host')
    }
  })

  it('keeps browser entry graphs free of Node and server-only dependencies', () => {
    const graph = runtimeGraph(path.join(repositoryRoot, 'src'))
    const browserEntries = frameworkPackageEntries.filter((entry) => (
      entry.name === 'client' || entry.name.startsWith('client/')
    ))
    for (const entry of browserEntries) {
      for (const file of transitiveFiles(graph, entry.source)) {
        const forbidden = sourceImports(file)
          .filter((dependency) => dependency.runtime)
          .map((dependency) => dependency.specifier)
          .filter((specifier) => nodeBuiltins.has(specifier) || /\.server(?:\.|$)/.test(specifier))
        expect(forbidden, `${entry.name}: ${path.relative(repositoryRoot, file)}`).toEqual([])
      }
    }
  })

  it('keeps the universal entry free of target-specific static imports', () => {
    const graph = runtimeGraph(path.join(repositoryRoot, 'src'))
    for (const file of transitiveFiles(graph, 'src/index.ts')) {
      const forbidden = sourceImports(file)
        .filter((dependency) => dependency.runtime)
        .map((dependency) => dependency.specifier)
        .filter((specifier) => /\.(?:client|server)(?:\.|$)/.test(specifier))
      expect(forbidden, path.relative(repositoryRoot, file)).toEqual([])
    }
  })
})
