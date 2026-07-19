import type { ComponentType, ReactNode } from 'react'

export interface PageMeta {
  title?: string
  description?: string
  draft?: boolean
}

export interface SiteConfig {
  title: string
  description?: string
  titleTemplate?: string
  navigation?: Array<{ label: string; href: string }>
}

export interface SiteShellProps {
  children: ReactNode
  route: ResolvedRoute
  site: SiteConfig
}

export interface NibConfig {
  base?: string
  site: SiteConfig
  shell?: ComponentType<SiteShellProps>
}

export interface PageModule {
  default: ComponentType
  meta?: PageMeta
}

export interface ResolvedRoute {
  path: string
  component: ComponentType
  meta: Required<Pick<PageMeta, 'title' | 'description'>> & PageMeta
  source: string
  status: number
}

export interface RenderedPage {
  status: number
  head: string
  html: string
  islands: string[]
}
