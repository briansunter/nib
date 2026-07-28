import { siteHref } from '@briansunter/nib'
import { Icon } from '../../components/icons'
import { PageHero } from '../../components/PageHero'

export const meta = {
  title: 'Explore',
  description: "Browse Brian Sunter's creative collections, recipes, photos, art, pins, and travel map",
}

const collections = [
  {
    href: '/photos',
    title: 'Photos',
    description: 'Travel and everyday photo galleries, organized by place and time.',
    path: 'M20 4h-3.17L15 2H9L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 14H4V6h4.05l1.83-2h4.24l1.83 2H20zM12 7a5 5 0 0 0-5 5a5 5 0 0 0 5 5a5 5 0 0 0 5-5a5 5 0 0 0-5-5m0 8a3 3 0 0 1-3-3a3 3 0 0 1 3-3a3 3 0 0 1 3 3a3 3 0 0 1-3 3',
  },
  {
    href: '/art',
    title: 'Studio',
    description: 'Paintings, studies, and other visual work from the studio.',
    path: 'M12 22A10 10 0 0 1 2 12A10 10 0 0 1 12 2c5.5 0 10 4 10 9a6 6 0 0 1-6 6h-1.8c-.3 0-.5.2-.5.5c0 .1.1.2.1.3c.4.5.6 1.1.6 1.7c.1 1.4-1 2.5-2.4 2.5m0-18a8 8 0 0 0-8 8a8 8 0 0 0 8 8c.3 0 .5-.2.5-.5c0-.2-.1-.3-.1-.4c-.4-.5-.6-1-.6-1.6c0-1.4 1.1-2.5 2.5-2.5H16a4 4 0 0 0 4-4c0-3.9-3.6-7-8-7m-5.5 6c.8 0 1.5.7 1.5 1.5S7.3 13 6.5 13S5 12.3 5 11.5S5.7 10 6.5 10m3-4c.8 0 1.5.7 1.5 1.5S10.3 9 9.5 9S8 8.3 8 7.5S8.7 6 9.5 6m5 0c.8 0 1.5.7 1.5 1.5S15.3 9 14.5 9S13 8.3 13 7.5S13.7 6 14.5 6m3 4c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5',
  },
  {
    href: '/recipes',
    title: 'Recipes',
    description: 'A searchable notebook of recipes for home cooking.',
    path: 'M12.5 1.5c-1.77 0-3.33 1.17-3.83 2.87C8.14 4.13 7.58 4 7 4a4 4 0 0 0-4 4a4.01 4.01 0 0 0 3 3.87V19h13v-7.13c1.76-.46 3-2.05 3-3.87a4 4 0 0 0-4-4c-.58 0-1.14.13-1.67.37c-.5-1.7-2.06-2.87-3.83-2.87m-.5 9h1v7h-1zm-3 2h1v5H9zm6 0h1v5h-1zM6 20v1a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-1z',
  },
  {
    href: '/pin-collection',
    title: 'Pin Collection',
    description: 'Enamel pins collected from places, projects, and events.',
    path: 'M12 2c3.9 0 7 3.1 7 7c0 5.2-7 13-7 13S5 14.2 5 9c0-3.9 3.1-7 7-7m0 2C9.2 4 7 6.2 7 9c0 1 0 3 5 9.7C17 12 17 10 17 9c0-2.8-2.2-5-5-5m0 7.5l2.4 1.5l-.6-2.8L16 8.3l-2.9-.2L12 5.4L10.9 8L8 8.3l2.2 1.9l-.7 2.8z',
  },
  {
    href: '/travel-map',
    title: 'Travel Map',
    description: 'An interactive record of countries, regions, and cities visited.',
    path: 'm20.5 3l-.16.03L15 5.1L9 3L3.36 4.9c-.21.07-.36.25-.36.48V20.5a.5.5 0 0 0 .5.5l.16-.03L9 18.9l6 2.1l5.64-1.9c.21-.07.36-.25.36-.48V3.5a.5.5 0 0 0-.5-.5M10 5.47l4 1.4v11.66l-4-1.4zm-5 .99l3-1.01v11.7l-3 1.16zm14 11.08l-3 1.01V6.86l3-1.16z',
  },
  {
    href: '/bitcoin',
    title: 'Bitcoin',
    description: 'Ways to support my writing and open-source work with Bitcoin.',
    path: 'M14.24 10.56c-.31 1.24-2.24.61-2.84.44l.55-2.18c.62.18 2.61.44 2.29 1.74m-3.11 1.56l-.6 2.41c.74.19 3.03.92 3.37-.44c.36-1.42-2.03-1.79-2.77-1.97m10.57 2.3c-1.34 5.36-6.76 8.62-12.12 7.28S.963 14.94 2.3 9.58A9.996 9.996 0 0 1 14.42 2.3c5.35 1.34 8.61 6.76 7.28 12.12m-7.49-6.37l.45-1.8l-1.1-.25l-.44 1.73c-.29-.07-.58-.14-.88-.2l.44-1.77l-1.09-.26l-.45 1.79c-.24-.06-.48-.11-.7-.17l-1.51-.38l-.3 1.17s.82.19.8.2c.45.11.53.39.51.64l-1.23 4.93c-.05.14-.21.32-.5.27c.01.01-.8-.2-.8-.2L6.87 15l1.42.36c.27.07.53.14.79.2l-.46 1.82l1.1.28l.45-1.81c.3.08.59.15.87.23l-.45 1.79l1.1.28l.46-1.82c1.85.35 3.27.21 3.85-1.48c.5-1.35 0-2.15-1-2.66c.72-.19 1.26-.64 1.41-1.62c.2-1.33-.82-2.04-2.2-2.52',
  },
]

export default function ExplorePage() {
  return (
    <div className="py-12 sm:py-16 md:py-20" data-pagefind-ignore>
      <PageHero title="Explore">
        Writing is only one part of this site. Browse the collections, tools, and creative work I keep here.
      </PageHero>
      <ul className="mt-10 grid list-none grid-cols-1 gap-4 p-0 sm:mt-14 sm:grid-cols-2 sm:gap-6">
        {collections.map((item) => (
          <li key={item.href}>
            <a
              href={siteHref(item.href)}
              className="group flex h-full gap-4 rounded-xl border border-border bg-surface-elevated p-5 transition-colors duration-200 hover:border-ink-muted hover:bg-surface-hover focus-accent sm:p-6"
            >
              <Icon path={item.path} className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
              <span>
                <span className="block font-sans text-xl font-semibold tracking-tight text-ink">{item.title}</span>
                <span className="mt-2 block font-serif text-base leading-relaxed text-ink-secondary">{item.description}</span>
                <span className="mt-4 block font-sans text-sm font-medium text-accent group-hover:text-accent-hover">
                  Browse <span aria-hidden="true">→</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
