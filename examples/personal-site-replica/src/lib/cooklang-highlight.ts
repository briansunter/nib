import { createHighlighterCoreSync } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import githubDark from '@shikijs/themes/github-dark'
import cooklangRegistration from './cooklangSyntax'

const cooklangHighlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [cooklangRegistration],
  engine: createJavaScriptRegexEngine(),
})

export function highlightCooklang(source: string): string {
  return cooklangHighlighter
    .codeToHtml(source.replace(/\n$/, ''), { lang: 'cook', theme: 'github-dark' })
    .replace('class="shiki github-dark"', 'class="astro-code github-dark"')
    .replace('" tabindex="0"', '; overflow-x: auto;" tabindex="0" data-language="cook"')
}
