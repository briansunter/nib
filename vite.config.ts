import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nibIslandsEntry } from './src/framework/island-vite-plugin'
import { nibMarkdown } from './src/framework/vite-plugin'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.SITE_BASE_PATH ?? (
  process.env.GITHUB_ACTIONS === 'true' && repository ? `/${repository}/` : '/'
)

export default defineConfig({
  plugins: [nibMarkdown(), react(), tailwindcss(), nibIslandsEntry()],
  base,
})
