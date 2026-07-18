import { renderPage } from './framework/render'
import { paths, routes } from './routes'

export { paths }
export function render(url: string) {
  return renderPage(routes, url)
}
