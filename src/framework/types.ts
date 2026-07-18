import type { ComponentType } from 'react'

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
