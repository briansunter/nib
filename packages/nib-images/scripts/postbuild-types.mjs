import fs from 'node:fs/promises'

await fs.copyFile('src/nib-image.d.ts', 'dist/nib-image.d.ts')
const declaration = await fs.readFile('dist/index.d.ts', 'utf8')
await fs.writeFile(
  'dist/index.d.ts',
  `/// <reference path="./nib-image.d.ts" />\n${declaration}`,
)
