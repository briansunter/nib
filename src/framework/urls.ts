export { stripBasePath } from './publication'

export function siteHref(path: string) {
  const base = configuredBasePath()
  const joined = `${base}${path.replace(/^\/+/, '')}`
  if (
    configuredTrailingSlash() === 'always'
    && joined !== base
    && !joined.endsWith('/')
    && !/\.[A-Za-z0-9]+(?:[?#]|$)/.test(joined)
  ) {
    return `${joined}/`
  }
  if (configuredTrailingSlash() === 'never' && joined !== base) {
    return joined.replace(/\/+$/, '')
  }
  return joined
}
declare const __NIB_BASE_PATH__: string
declare const __NIB_TRAILING_SLASH__: 'always' | 'never' | 'ignore'

function configuredBasePath(): string {
  return typeof __NIB_BASE_PATH__ === 'string' ? __NIB_BASE_PATH__ : '/'
}

function configuredTrailingSlash(): 'always' | 'never' | 'ignore' {
  return typeof __NIB_TRAILING_SLASH__ === 'string'
    ? __NIB_TRAILING_SLASH__
    : 'ignore'
}
