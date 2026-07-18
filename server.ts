import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import { createServer as createViteServer } from 'vite'

const root = process.cwd()
const port = Number(process.env.PORT ?? 5173)
const app = express()
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' })
app.use(vite.middlewares)

app.use(async (request, response, next) => {
  try {
    let template = await fs.readFile(path.resolve(root, 'index.html'), 'utf8')
    template = await vite.transformIndexHtml(request.originalUrl, template)
    const { render } = await vite.ssrLoadModule('/src/entry-server.tsx')
    const page = render(request.originalUrl)
    response.status(page.status).type('html').send(
      template.replace('<!--head-outlet-->', page.head).replace('<!--ssr-outlet-->', page.html),
    )
  } catch (error) {
    vite.ssrFixStacktrace(error as Error)
    next(error)
  }
})

app.listen(port, () => console.log(`Mini Static: http://localhost:${port}`))
