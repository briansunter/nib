import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { getRoute } from './framework/router'
import { stripBasePath } from './framework/urls'
import { routes } from './routes'
import site from './site.config'
import './style.css'

const route = getRoute(
  routes,
  stripBasePath(window.location.pathname, import.meta.env.BASE_URL),
)
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode><App route={route} site={site} /></StrictMode>,
)
