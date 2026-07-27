import { siteHref } from '@briansunter/nib'

export const meta = {
  title: 'Explore',
  description: "Browse Brian Sunter's collections, recipes, photos, art, pins, and travel map.",
}

interface Link {
  href: string
  title: string
  description: string
}

const collections: Link[] = [
  { href: '/pages', title: 'Writing', description: 'Notes about technology, productivity, and creative practice.' },
  { href: '/projects', title: 'Projects', description: 'Software projects, experiments, and open source contributions.' },
  { href: '/recipes', title: 'Recipes', description: 'A plain-text Cooklang collection for home cooking.' },
  { href: '/art', title: 'Art', description: 'Urban sketches, watercolor, and field drawings.' },
  { href: '/photos', title: 'Photos', description: 'Travel photos from Hawaii, London, and Los Angeles.' },
  { href: '/pin-collection', title: 'Pin collection', description: 'A lapel pin collection gathered from travels and events.' },
  { href: '/travel-map', title: 'Travel map', description: 'Places visited, collected on one map.' },
  { href: '/tags', title: 'Tags', description: 'Browse every topic used across the site.' },
  { href: '/search', title: 'Search', description: 'Search the writing, projects, and recipes.' },
]
const support: Link[] = [
  { href: '/bitcoin', title: 'Bitcoin', description: 'Support the site with Bitcoin.' },
  { href: '/about', title: 'About', description: 'A short introduction.' },
  { href: '/privacy', title: 'Privacy', description: 'How this site handles data.' },
  { href: '/index.xml', title: 'RSS', description: 'Subscribe to the feed.' },
]

export default function ExplorePage() {
  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Everything in one place</p>
        <h1>Explore</h1>
        <p className="lead">Writing is only one part of this site. Browse the collections, tools, and creative work kept here.</p>
      </header>
      <section className="content-column">
        <h2>Collections</h2>
        <ul className="link-grid">
          {collections.map((item) => (
            <li key={item.href}>
              <a href={siteHref(item.href)}>
                <span className="block-title">{item.title}</span>
                <span className="block-description">{item.description}</span>
                <span className="eyebrow">Browse →</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="content-column">
        <h2>Support &amp; info</h2>
        <ul className="link-grid">
          {support.map((item) => (
            <li key={item.href}>
              <a href={siteHref(item.href)}>
                <span className="block-title">{item.title}</span>
                <span className="block-description">{item.description}</span>
                <span className="eyebrow">Open →</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
