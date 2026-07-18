import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { miniStaticMarkdown } from './src/framework/vite-plugin'

export default defineConfig({
  plugins: [miniStaticMarkdown(), react(), tailwindcss()],
})
