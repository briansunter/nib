// Legacy URL redirects ported from the source Astro site's
// config/redirects.ts so backlinks continue to resolve. Two stale entries
// (/tags/openai and /tags/logseq-openai/project) are dropped because those
// tags now have generated pages in this replica. /notes -> /pages and
// /rss.xml -> /index.xml are declared in nib.config.ts directly.

export const sourceRedirects: Readonly<Record<string, string>> = {
  // Newsletter redirects
  '/newsletter': '/',
  '/pages/newsletter/issue/2': '/newsletter/issue-2',
  '/pages/newsletter-issue-1': '/newsletter/issue-1',
  '/pages/newsletter/issue/3': '/newsletter/issue-3',
  '/pages/newsletter/issue/4': '/newsletter/issue-4',
  '/pages/newsletter/issue/5': '/newsletter/issue-5',
  '/pages/newsletter-6': '/newsletter/issue-6',
  '/pages/newsletter-7': '/newsletter/issue-7',
  '/pages/newsletter-issue-8': '/newsletter/issue-8',
  '/pages/newsletter-issue-9': '/newsletter/issue-9',
  '/pages/newsletter/issue-1': '/newsletter/issue-1',
  '/pages/newsletter/issue-10': '/newsletter/issue-10',
  '/pages/newsletter/issue-11': '/newsletter/issue-11',
  '/pages/newsletter/issue-12': '/newsletter/issue-12',
  '/pages/newsletter/issue-13': '/newsletter/issue-13',
  '/pages/newsletter/issue-14': '/newsletter/issue-14',
  '/pages/newsletter/issue-15': '/newsletter/issue-15',
  '/pages/newsletter/issue-16': '/newsletter/issue-16',

  // Blog entry redirects (now routed at root level)
  '/blog/how-to-take-smart-notes-roam-research': '/how-to-take-smart-notes',

  // Legacy /pages/* redirects for migrated content
  '/pages/ai-learning-resources': '/ai-learning-resources',
  '/pages/almanack-of-naval-ravikant': '/almanack-of-naval-ravikant',
  '/pages/logseq-getting-started': '/logseq-getting-started',
  '/pages/you-and-your-research': '/you-and-your-research',
  '/pages/algorithms-boot-camp-study-guide': '/algorithms-boot-camp',
  '/algorithms-boot-camp-study-guide': '/algorithms-boot-camp',
  '/pages/gpt3-openai-api-tutorial': '/ai-powered-notetaking-with-the-gpt-3-logseq-plugin',
  '/pages/building-a-second-brain': '/building-a-second-brain',
  '/pages/how-to-take-smart-notes': '/how-to-take-smart-notes',
  '/pages/notetaking-with-ai': '/notetaking-with-ai',
  '/pages/logseq-projects': '/logseq-projects',
  '/pages/cooklang': '/cooklang',
  '/pages/python-setup-pyenv-poetry': '/python-setup-pyenv-poetry',
  '/pages/five-minute-journal': '/five-minute-journal',
  '/pages/why-clojure': '/why-clojure',
  '/pages/emacs-daemon-mode-on-macos': '/emacs-daemon-mode-on-macos',
  '/pages/prompt-engineering': '/ai-learning-resources',
  '/pages/midjourney': '/ai-learning-resources',
  '/pages/stable-diffusion': '/ai-learning-resources',
  '/pages/gpt4-ai-assistant': '/ai-learning-resources',
  '/pages/linked-list': '/algorithms',
  '/pages/heap': '/heap',
  '/pages/binary-search': '/binary-search',
  '/pages/big-o-notation': '/algorithms',
  '/pages/sorting-algorithms': '/algorithms',
  '/pages/graph-algorithms': '/algorithms',
  '/pages/dynamic-programming': '/algorithms',
  '/pages/tree-algorithms': '/algorithms',
  '/pages/recursion': '/algorithms',
  '/pages/array-algorithms': '/algorithms',
  '/pages/string-algorithms': '/algorithms',
  '/pages/hash-table': '/algorithms',
  '/pages/stack-and-queue': '/algorithms',

  // Additional /pages/* redirects from 404 report
  '/pages/travels-with-charley': '/travels-with-charley',
  '/pages/100-newsletter-subscribers': '/100-newsletter-subscribers',
  '/pages/game-review-template': '/game-review-template',
  '/pages/machine-learning-study-guide-gpt': '/machine-learning-study-guide-gpt',
  '/pages/machine-learning-study-guide': '/machine-learning-study-guide',
  '/pages/intro-to-algorithms': '/intro-to-algorithms',
  '/pages/gpt3-chinese-language-tutor': '/gpt3-chinese-language-tutor',
  '/pages/omnivore-logseq-guide': '/omnivore-logseq-guide',
  '/pages/daily-highlight-productivity-technique': '/daily-highlight-productivity-technique',
  '/pages/poodle-mixes': '/poodle-mixes',
  '/pages/posteriori-vs-a-priori-analysis-of-algorithms': '/posteriori-vs-a-priori-analysis-of-algorithms',
  '/pages/integer-sum-formula': '/integer-sum-formula',
  '/pages/headphone-eye-mask': '/headphone-eye-mask',
  '/pages/soma': '/soma',
  '/pages/why-large-language-models-are-interesting': '/why-large-language-models-are-interesting',
  '/pages/new-website-on-logseq-hugo': '/new-website-on-logseq-hugo',
  '/pages/werner-herzog-rules-for-filmmaking': '/werner-herzog-rules-for-filmmaking',
  '/pages/books-read-in-2022': '/books-read-in-2022',
  '/pages/how-to-use-gpt3-to-learn-kubernetes': '/how-to-use-gpt3-to-learn-kubernetes',
  '/pages/newsletter-roadmap': '/newsletter-roadmap',
  '/pages/algorithms-boot-camp': '/algorithms-boot-camp',
  '/pages/logseq-gpt-prompt-template': '/logseq-openai-prompt-template',
  '/pages/logseq-openai/popup': '/logseq-openai/popup',
  '/pages/logseq-social/profile': '/',
  '/pages/comparison-template': '/',
  '/pages/git': '/',
  '/pages/texas-roadhouse-rolls': '/recipes',

  // Legacy /blog/* redirects
  '/blog/python-setup-pyenv-poetry': '/python-setup-pyenv-poetry',
  '/blog/cooklang': '/cooklang',
  '/blog/five-minute-journal': '/five-minute-journal',
  '/blog/why-clojure': '/why-clojure',
  '/blog/emacs-daemon-macos': '/emacs-daemon-mode-on-macos',
  '/blog/logseq-getting-started': '/logseq-getting-started',
  '/blog/building-a-second-brain': '/building-a-second-brain',
  '/blog/how-to-take-smart-notes': '/how-to-take-smart-notes',
  '/blog/gpt3-openai-api-tutorial': '/ai-powered-notetaking-with-the-gpt-3-logseq-plugin',
  '/blog/notetaking-with-ai': '/notetaking-with-ai',

  // Algorithm page redirects
  '/abdul-bari-algorithms': '/algorithms',
  '/pages/abdul-bari-algorithms': '/algorithms',
  '/abdul-bari-algorithms/time-complexity': '/time-complexity',
  '/abdul-bari-algorithms/binary-search': '/binary-search',
  '/abdul-bari-algorithms/heap': '/heap',
  '/abdul-bari-algorithms/recurrence-relation-masters-theorem-subtracting': '/recurrence-relation-masters-theorem-subtracting',
  '/abdul-bari-algorithms/recurrence-relation-masters-theorem-dividing': '/recurrence-relation-masters-theorem-dividing',

  // Nested URL patterns
  '/pages/abdul-bari-algorithms/heap': '/heap',
  '/pages/abdul-bari-algorithms/linked-list': '/algorithms',
  '/pages/abdul-bari-algorithms/binary-search': '/binary-search',
  '/pages/abdul-bari-algorithms/sorting': '/algorithms',
  '/pages/abdul-bari-algorithms/graph': '/algorithms',
  '/pages/abdul-bari-algorithms/dynamic-programming': '/algorithms',
  '/pages/abdul-bari-algorithms/tree': '/algorithms',
  '/pages/abdul-bari-algorithms/recursion': '/algorithms',
  '/pages/abdul-bari-algorithms/time-complexity': '/time-complexity',
  '/pages/abdul-bari-algorithms/recurrence-relation-masters-theorem-subtracting': '/recurrence-relation-masters-theorem-subtracting',
  '/pages/abdul-bari-algorithms/recurrence-relation-masters-theorem-dividing': '/recurrence-relation-masters-theorem-dividing',

  // Logseq prefixed paths
  '/logseq/ai-powered-notetaking-with-the-gpt-3-logseq-plugin': '/ai-powered-notetaking-with-the-gpt-3-logseq-plugin',
  '/logseq-social/profile/bsunter': '/',
  '/logseq-social': '/',

  // Graph page (old Logseq graph viewer)
  '/graph': '/',

  // RSS/XML feeds
  '/pages/index.xml': '/index.xml',

  // Legacy tag/category variants that do not have generated tag pages
  '/tags/large%20language%20models': '/tags/large-language-models',
  '/categories/logseq': '/pages',
  '/category/functional': '/pages',

  // Recipe-related redirects
  '/notes/cooking': '/recipes',

  // Other broken paths
  '/bubble-sort': '/algorithms',
  '/managing-python-projects-and-dependencies': '/python-setup-pyenv-poetry',
  '/second-post': '/',
  '/content/logseq/newsletter/issue-3.md': '/newsletter/issue-3',
  '/content/logseq/newsletter/issue-12.md': '/newsletter/issue-12',
  '/content/logseq/newsletter/issue-13.md': '/newsletter/issue-13',
  '/content/logseq/five-minute-journal.md': '/five-minute-journal',

  // Broken internal link redirects (from newsletter content)
  '/logseq-gpt3-ai-plugin': '/notetaking-with-ai',
  '/second-brain': '/building-a-second-brain',
  '/logseq-second-brain': '/building-a-second-brain',
  '/homepage': '/',
  '/logseq-tasks': '/logseq-projects',
  '/get-youtube-subtitles': '/notetaking-with-ai',
  '/information-diet': '/building-a-second-brain',
  '/meal-prep': '/recipes',
  '/project-template': '/',
  '/tour-of-my-project-template': '/',
  '/restoring-old-photos-with-ai': '/notetaking-with-ai',

  // Date-based newsletter pages (redirect to newsletter index)
  '/jun-12th,-2022': '/newsletter',
  '/jun-19th,-2022': '/newsletter',
  '/jun-26th,-2022': '/newsletter',
  '/jul-3rd,-2022': '/newsletter',
  '/jul-10th,-2022': '/newsletter',

  // Bare legacy paths (the /pages/* variants already exist; Google also
  // crawled the bare forms from old backlinks).
  '/texas-roadhouse-rolls': '/recipes',
  '/comparison-template': '/',
  '/git': '/',
  '/project/template': '/',
  '/managing-python-projects-and-dependencies-in-2022': '/python-setup-pyenv-poetry',

  // Legacy /logseq/* paths (original map had only one)
  '/logseq/python-setup-pyenv-poetry': '/python-setup-pyenv-poetry',
  '/logseq-social/profile': '/',

  // Pure-prefix legacy roots
  '/archives': '/pages',
  '/categories': '/pages',

  // Additional /tags/* collapses surfaced by GSC
  '/tags/abdul-bari-algorithms': '/pages',
  '/tags/course': '/pages',
  '/tags/recipe': '/pages',

  // Typo / variant paths crawled by Google
  '/blog/gtp3-openai-logseq-notetaking': '/ai-powered-notetaking-with-the-gpt-3-logseq-plugin',
  '/blog/fzf': '/',
  '/recipes/air-fryer-chicken-parmesean': '/recipes/air-fryer-chicken-parmesan',
  '/pages/abdul-bari-algorithms-part-1': '/algorithms',

  // Old recipe source/cookbook names indexed as paths by the previous site
  '/recipes/Tasty': '/recipes',
  '/recipes/Onolicious': '/recipes',

  // Renamed project (mankey → anki-ai) without redirect
  '/projects/mankey': '/projects/anki-ai',

  // Missing /pages/* entry from the batch migration
  '/pages/index': '/pages',
  '/pages/central-pacific-update': '/central-pacific-update',

  // Sitemap: robots.txt points to /sitemap-index.xml; Nib emits /sitemap.xml.
  '/sitemap-index.xml': '/sitemap.xml',
}
