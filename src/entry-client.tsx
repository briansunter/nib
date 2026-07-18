import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { getRoute } from './framework/router'
import { routes } from './routes'
import site from './site.config'
import './style.css'

const route = getRoute(routes, window.location.pathname)
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode><App route={route} site={site} /></StrictMode>,
)
