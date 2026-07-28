import { siteHref, type SiteShellProps } from '@briansunter/nib'
import { GLYPHS, Icon, SocialGlyph } from './components/icons'
import type { Writing } from './content'
import ShellBehavior from './islands/shell-behavior'
import { blogPosts } from './lib/content-queries'
import {
  footerSocials,
  isExternalLink,
  NEWSLETTER_API,
  NEWSLETTER_LINK,
  SITE_TAGLINE,
} from './lib/site'

function normalizePath(path: string): string {
  const noSlash = path.replace(/\/+$/, '')
  return noSlash === '' ? '/' : noSlash
}

function isActive(href: string, current: string): boolean {
  if (isExternalLink(href)) return false
  if (href === '/') return false
  const base = href.replace(/\/+$/, '')
  return current === base || current.startsWith(`${base}/`)
}

function navHref(href: string): string {
  return isExternalLink(href) ? href : siteHref(href)
}

function navLinkClass(active: boolean): string {
  return [
    'relative text-sm lg:text-base font-medium transition-colors duration-200 focus-accent rounded-sm py-1',
    active ? 'text-ink' : 'text-ink-secondary hover:text-ink',
  ].join(' ')
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

function ThemeToggle() {
  return (
    <button
      data-theme-toggle
      type="button"
      aria-label="Toggle theme"
      title="Toggle light/dark mode"
      className="relative flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink focus-accent"
    >
      <Icon path={GLYPHS.sun} viewBox="0 0 20 20" className="hidden h-5 w-5" dataThemeIcon="light" />
      <Icon path={GLYPHS.moon} viewBox="0 0 20 20" className="hidden h-5 w-5" dataThemeIcon="dark" />
    </button>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg data-newsletter-button-spinner className={className} viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" fill="none" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function NewsletterForm({ site }: { site: string }) {
  return (
    <>
      <form className="flex flex-col gap-3" data-api-url={NEWSLETTER_API} data-site={site} data-newsletter-form>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
          aria-label="Email address"
          data-newsletter-email
          className="form-input"
        />
        <button type="submit" data-newsletter-submit className="primary-button w-full">
          <span data-newsletter-button-text>Subscribe</span>
          <Spinner className="hidden h-4 w-4 animate-spin" />
        </button>
      </form>
      <div data-newsletter-success role="status" aria-live="polite" className="hidden font-sans text-footnote status-success">
        You&apos;re on the list.
      </div>
      <div data-newsletter-error role="alert" className="hidden font-sans text-footnote status-danger">
        <span data-newsletter-error-message>Please try again.</span>
      </div>
    </>
  )
}

export function SiteShell({ children, route, site, collections }: SiteShellProps<any>) {
  const current = normalizePath(route.path)
  const navigation = site.navigation ?? []
  const year = new Date().getFullYear()
  const writing = (collections as { writing: Array<{ data: Writing }> }).writing
  const latestWriting = blogPosts(writing.map((entry) => entry.data)).slice(0, 3)
  const elsewhere = footerSocials()
  // The homepage already has the primary newsletter CTA; the reference
  // suppresses its footer form there to avoid repeating the same conversion.
  const hideFooterNewsletter = current === '/' || writing.some((entry) => `/${entry.data.slug}` === current)
  const labelClass = 'overline-label m-0'
  const isStandalone = ['/art', '/photos', '/pin-collection', '/travel-map'].includes(current)

  return (
    <div className="site-frame min-h-screen flex flex-col">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header
        className={`${isStandalone ? 'relative' : 'sticky top-0'} z-30`}
        data-pagefind-ignore=""
      >
        <div
          data-site-header
          data-scroll-y="50"
          className="header-glass border-b border-border transition-[padding,background-color,border-color,box-shadow] duration-300 py-4"
        >
          <div className="flex w-full items-center justify-between px-4 sm:px-6 lg:px-8">
            <a
              href={siteHref('/')}
              data-astro-prefetch="hover"
              className="focus-accent rounded-sm text-h3 font-semibold tracking-tight text-ink transition-colors duration-200 hover:text-accent"
            >
              {site.title}
            </a>

            <nav
              aria-label="Primary navigation"
              className={`hidden items-center ${isStandalone ? 'gap-10' : 'gap-8'} lg:!flex`}
            >
              {navigation.map((item) => {
                const active = isActive(item.href, current)
                return (
                  <a
                    key={item.href}
                    href={navHref(item.href)}
                    data-astro-prefetch={!isExternalLink(item.href) ? 'hover' : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={navLinkClass(active)}
                  >
                    {item.label}
                    {active && <span className="absolute -bottom-1.5 left-0 h-px w-full bg-accent" />}
                  </a>
                )
              })}
              <ThemeToggle />
            </nav>

            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <button
                id="site-mobile-menu-toggle"
                type="button"
                data-mobile-menu-toggle
                aria-controls="site-mobile-menu"
                aria-expanded="false"
                aria-label="Open menu"
                className="mobile-menu-toggle inline-flex h-12 w-12 min-h-12 min-w-12 items-center justify-center rounded-xl p-2 text-ink transition-[color,background-color,opacity] duration-200 hover:bg-surface-hover focus-accent"
              >
                <svg
                  data-mobile-menu-open-icon
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d={GLYPHS.menu} clipRule="evenodd" />
                </svg>
                <svg
                  data-mobile-menu-close-icon
                  className="hidden h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d={GLYPHS.close} clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <nav
            id="site-mobile-menu"
            data-mobile-menu
            aria-label="Mobile navigation"
            aria-hidden="true"
            className="hidden w-full lg:hidden"
          >
            <div className="flex flex-col gap-1 border-t border-border bg-surface-elevated px-4 py-3">
              {navigation.map((item) => {
                const active = isActive(item.href, current)
                return (
                  <a
                    key={item.href}
                    href={navHref(item.href)}
                    data-astro-prefetch={!isExternalLink(item.href) ? 'hover' : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex min-h-12 items-center rounded-lg px-4 py-3 text-lg font-medium transition-colors duration-200 focus-accent active:bg-surface-hover',
                      active ? 'bg-surface-hover text-ink' : 'text-ink-secondary hover:bg-surface-hover/50 hover:text-ink',
                    ].join(' ')}
                  >
                    {item.label}
                  </a>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      {isStandalone ? (
        <div id="main-content" tabIndex={-1} className="w-full flex-1">
          {children}
        </div>
      ) : (
        <main id="main-content" className="mx-auto w-full flex-1 overflow-x-hidden px-2 py-4">
          {children}
        </main>
      )}

      <footer
        className="mt-24 border-t border-border bg-surface lg:mt-32"
        data-pagefind-ignore=""
      >
        <div className="mx-auto w-full max-w-5xl px-6 pb-7 pt-14 sm:px-10">
          <div className={[
            'grid grid-cols-1 items-start gap-10 sm:grid-cols-2 sm:gap-12',
            hideFooterNewsletter ? 'md:grid-cols-3' : 'md:grid-cols-4',
          ].join(' ')}>
            <section data-footer-column="brand" aria-label="Site identity" className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="bs-mark bs-mark--sm" aria-hidden="true">BS</span>
                <span className="font-sans text-sm font-semibold leading-none tracking-tight text-ink">{site.title}</span>
              </div>
              <p className="m-0 font-serif text-sm font-normal italic leading-snug text-ink-muted">{SITE_TAGLINE}</p>
            </section>

            <section data-footer-column="latest" aria-labelledby="footer-latest-heading" className="flex flex-col gap-4">
              <h2 id="footer-latest-heading" className={labelClass}>Latest writing</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {latestWriting.map((post) => {
                  return (
                    <li key={post.slug} className="flex flex-col gap-0.5">
                      <a
                        href={siteHref(`/${post.slug}`)}
                        data-astro-prefetch="hover"
                        data-umami-event="footer_latest_click"
                        data-umami-event-slug={post.slug}
                        title={post.title}
                        className="focus-accent rounded-sm font-serif text-sm leading-snug text-ink-secondary transition-colors duration-200 line-clamp-1 hover:text-ink"
                      >
                        {post.title}
                      </a>
                      <span className="overline-label">{dateFormatter.format(post.date)}</span>
                    </li>
                  )
                })}
              </ul>
              <a
                href={siteHref('/pages')}
                data-astro-prefetch="hover"
                data-umami-event="footer_nav_click"
                data-umami-event-target="archive"
                className="focus-accent group inline-flex items-center gap-1 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:text-accent rounded-sm"
              >
                All writing
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </a>
            </section>

            <section data-footer-column="elsewhere" aria-labelledby="footer-elsewhere-heading" className="flex flex-col gap-4">
              <h2 id="footer-elsewhere-heading" className={labelClass}>Elsewhere</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {elsewhere.map((social) => (
                  <li key={social.name}>
                    <a
                      href={social.url}
                      target={social.external ? '_blank' : undefined}
                      rel={social.external ? 'noopener noreferrer' : undefined}
                      aria-label={`Visit ${social.name}`}
                      data-umami-event="outbound"
                      data-umami-event-platform={social.name.toLowerCase()}
                      className="focus-accent rounded-sm inline-flex items-center gap-2 text-sm text-ink-secondary transition-colors duration-200 hover:text-ink"
                    >
                      <SocialGlyph name={social.icon} className="w-3.5 h-3.5" />
                      <span className="leading-none">{social.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            {!hideFooterNewsletter && (
              <section
                data-footer-column="subscribe"
                aria-labelledby="footer-subscribe-heading"
                className="newsletter-signup flex flex-col gap-4"
              >
                <h2 id="footer-subscribe-heading" className={labelClass}>Subscribe</h2>
                <p className="m-0 font-sans text-footnote leading-relaxed text-ink-muted">
                  Occasional emails on what I&apos;m building and reading.{' '}
                  <a
                    href={NEWSLETTER_LINK}
                    data-umami-event="newsletter_substack_click"
                    data-umami-event-source="footer"
                    className="focus-accent rounded-sm underline underline-offset-2 transition-colors hover:text-ink-secondary"
                  >
                    Read on Substack →
                  </a>
                </p>
                <NewsletterForm site="footer" />
              </section>
            )}
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-3.5 border-t border-border pt-6 font-sans text-footnote text-ink-muted">
            <span>© {year} {site.title}</span>
            <span className="mx-1 select-none text-border" aria-hidden="true">·</span>
            <a
              href={siteHref('/index.xml')}
              data-astro-prefetch="hover"
              data-umami-event="footer_nav_click"
              data-umami-event-target="rss"
              className="focus-accent rounded-sm transition-colors duration-200 hover:text-ink"
            >
              RSS
            </a>
            <span className="mx-1 select-none text-border" aria-hidden="true">·</span>
            <a
              href={siteHref('/privacy')}
              data-astro-prefetch="hover"
              data-umami-event="footer_nav_click"
              data-umami-event-target="privacy"
              className="focus-accent rounded-sm transition-colors duration-200 hover:text-ink"
            >
              Privacy
            </a>
          </div>
        </div>
      </footer>

      <button
        id="back-to-top"
        type="button"
        className="fixed bottom-6 right-6 z-40 hidden h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface-elevated text-ink-secondary shadow-float transition-[background-color,color,opacity,transform] duration-200 hover:bg-surface-hover hover:text-ink focus-accent"
        aria-label="Back to top"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>

      <ShellBehavior />
    </div>
  )
}
