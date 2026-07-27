import { siteHref, type SiteShellProps } from '@briansunter/nib'
import { GLYPHS, Icon, SocialGlyph } from './components/icons'
import type { Writing } from './content'
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
  if (href === '/') return current === '/'
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
      className="icon-button"
    >
      <Icon path={GLYPHS.sun} className="hidden w-5 h-5" dataThemeIcon="light" />
      <Icon path={GLYPHS.moon} className="hidden w-5 h-5" dataThemeIcon="dark" />
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
        <Spinner className="hidden w-4 h-4 animate-spin" />
      </button>
      <div data-newsletter-success role="status" aria-live="polite" className="hidden status-success text-sm">
        You&apos;re on the list.
      </div>
      <div data-newsletter-error role="alert" className="hidden status-danger text-sm">
        <span data-newsletter-error-message>Please try again.</span>
      </div>
    </form>
  )
}

export function SiteShell({ children, route, site, collections }: SiteShellProps<any>) {
  const current = normalizePath(route.path)
  const navigation = site.navigation ?? []
  const year = new Date().getFullYear()
  const writing = (collections as { writing: Array<{ data: Writing }> }).writing
  const latestWriting = [...writing]
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 3)
  const elsewhere = footerSocials()
  // The homepage already has the primary newsletter CTA; the reference
  // suppresses its footer form there to avoid repeating the same conversion.
  const hideFooterNewsletter = current === '/'
  const labelClass = 'overline-label m-0'

  return (
    <div className="site-frame min-h-screen flex flex-col">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30">
        <div
          data-site-header
          data-scroll-y="50"
          className="header-glass border-b border-border transition-[padding,background-color,border-color,box-shadow] duration-300 py-4"
        >
          <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <a
              href={siteHref('/')}
              className="focus-accent rounded-sm text-h3 font-semibold tracking-tight text-ink transition-colors duration-200 hover:text-accent"
            >
              {site.title}
            </a>

            <nav aria-label="Primary navigation" className="hidden items-center gap-8 lg:flex">
              {navigation.map((item) => {
                const active = isActive(item.href, current)
                return (
                  <a
                    key={item.href}
                    href={navHref(item.href)}
                    aria-current={active ? 'page' : undefined}
                    target={isExternalLink(item.href) ? '_blank' : undefined}
                    rel={isExternalLink(item.href) ? 'noopener noreferrer' : undefined}
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
                <Icon path={GLYPHS.menu} className="h-6 w-6" />
                <Icon path={GLYPHS.close} className="hidden h-6 w-6" />
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
                    aria-current={active ? 'page' : undefined}
                    target={isExternalLink(item.href) ? '_blank' : undefined}
                    rel={isExternalLink(item.href) ? 'noopener noreferrer' : undefined}
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

      <main id="main-content" className="mx-auto w-full flex-1 overflow-x-hidden px-2 py-4">
        {children}
      </main>

      <button id="back-to-top" data-back-to-top type="button" aria-label="Back to top" className="back-to-top" hidden>
        ↑
      </button>

      <footer className="mt-24 border-t border-border bg-surface lg:mt-32">
        <div className="mx-auto w-full max-w-5xl px-6 pb-7 pt-14 sm:px-10">
          <div className={[
            'grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-12',
            hideFooterNewsletter ? 'md:grid-cols-3' : 'md:grid-cols-4',
          ].join(' ')}>
            <section aria-label="Site identity" className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="bs-mark bs-mark--sm" aria-hidden="true">BS</span>
                <span className="text-sm font-semibold leading-none tracking-tight text-ink">{site.title}</span>
              </div>
              <p className="m-0 text-sm font-normal italic leading-snug text-ink-muted">{SITE_TAGLINE}</p>
            </section>

            <section aria-labelledby="footer-latest-heading" className="flex flex-col gap-4">
              <h2 className={labelClass}>Latest writing</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {latestWriting.map((entry) => {
                  const post = entry.data
                  return (
                    <li key={post.slug} className="flex flex-col gap-0.5">
                      <a
                        href={siteHref(`/${post.slug}`)}
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
                className="focus-accent group inline-flex items-center gap-1 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:text-accent rounded-sm"
              >
                All writing
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </a>
            </section>

            <section aria-labelledby="footer-elsewhere-heading" className="flex flex-col gap-4">
              <h2 className={labelClass}>Elsewhere</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {elsewhere.map((social) => (
                  <li key={social.name}>
                    <a
                      href={social.url}
                      target={social.external ? '_blank' : undefined}
                      rel={social.external ? 'noopener noreferrer' : undefined}
                      aria-label={`Visit ${social.name}`}
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
              <section aria-labelledby="footer-subscribe-heading" className="flex flex-col gap-4">
                <h2 className={labelClass}>Subscribe</h2>
                <p className="m-0 text-sm leading-relaxed text-ink-muted">
                  Occasional emails on what I&apos;m building and reading.{' '}
                  <a
                    href={NEWSLETTER_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-accent rounded-sm underline underline-offset-2 transition-colors hover:text-ink-secondary"
                  >
                    Read on Substack →
                  </a>
                </p>
                <NewsletterForm site="footer" />
              </section>
            )}
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-3.5 border-t border-border pt-6 text-sm text-ink-muted">
            <span>© {year} {site.title}</span>
            <span className="mx-1 select-none text-border" aria-hidden="true">·</span>
            <a href={siteHref('/index.xml')} className="focus-accent rounded-sm transition-colors duration-200 hover:text-ink">
              RSS
            </a>
            <span className="mx-1 select-none text-border" aria-hidden="true">·</span>
            <a href={siteHref('/privacy')} className="focus-accent rounded-sm transition-colors duration-200 hover:text-ink">
              Privacy
            </a>
          </div>
        </div>
      </footer>

      <ShellBehaviorScript />
    </div>
  )
}

/**
 * Inline behavior for the static shell: mobile menu, social "more/less", and
 * the newsletter signup flow. Mirrors the reference site's vanilla-JS
 * initializers (Header, SocialProfiles, NewsletterSignup). Runs once per full
 * page load — Nib is a multi-page static site, so every navigation re-parses
 * the document and re-executes this script.
 */
function ShellBehaviorScript() {
  const script = `
(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function initHeader() {
    var header = document.querySelector('[data-site-header]');
    if (!header || header.__nibHeader) return;
    header.__nibHeader = true;
    var toggle = header.querySelector('[data-mobile-menu-toggle]');
    var menu = header.querySelector('[data-mobile-menu]');
    var openIcon = toggle && toggle.querySelectorAll('svg')[0];
    var closeIcon = toggle && toggle.querySelectorAll('svg')[1];
    function setOpen(open, restoreFocus) {
      if (!toggle || !menu) return;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      menu.classList.toggle('hidden', !open);
      if (openIcon) openIcon.classList.toggle('hidden', open);
      if (closeIcon) closeIcon.classList.toggle('hidden', !open);
      toggle.classList.toggle('is-active', open);
      if (!open && restoreFocus) toggle.focus();
    }
    toggle && toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu && menu.addEventListener('click', function (event) {
      if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, true);
    });
    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 1024px)').matches) setOpen(false);
    });
  }

  function initSocial() {
    var button = document.querySelector('[data-social-more]');
    if (!button || button.__nibSocial) return;
    button.__nibSocial = true;
    button.addEventListener('click', function () {
      var groupId = button.getAttribute('aria-controls');
      var group = groupId && document.getElementById(groupId);
      if (!group) return;
      var next = button.getAttribute('aria-expanded') !== 'true';
      group.hidden = !next;
      button.setAttribute('aria-expanded', String(next));
      button.textContent = next ? (button.dataset.lessLabel || 'Less') : (button.dataset.moreLabel || 'More');
    });
  }

  function initNewsletterForms() {
    document.querySelectorAll('[data-newsletter-form]').forEach(function (form) {
      if (form.__nibNewsletter) return;
      form.__nibNewsletter = true;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var api = form.getAttribute('data-api-url');
        var emailInput = form.querySelector('[data-newsletter-email]') || form.querySelector('input[type="email"]');
        var email = emailInput && emailInput.value;
        if (!email) return;
        var submit = form.querySelector('[data-newsletter-submit]');
        var text = form.querySelector('[data-newsletter-button-text]');
        var spinner = form.querySelector('[data-newsletter-button-spinner]');
        var success = form.querySelector('[data-newsletter-success]');
        var errorBox = form.querySelector('[data-newsletter-error]');
        var errorMsg = form.querySelector('[data-newsletter-error-message]');
        var root = form.closest('.newsletter-signup') || form.parentElement;
        var priorSuccess = root && root.querySelector('[data-newsletter-success]');
        var priorError = root && root.querySelector('[data-newsletter-error]');
        function show(el) { el && el.classList.remove('hidden'); }
        function hide(el) { el && el.classList.add('hidden'); }
        hide(success); hide(priorSuccess); hide(errorBox); hide(priorError);
        if (submit) submit.disabled = true;
        if (text) text.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');
        var body = new URLSearchParams();
        body.append('email', email);
        fetch(api, { method: 'POST', body: body, headers: { 'Accept': 'application/json' } })
          .then(function (res) { if (!res.ok) throw new Error('status ' + res.status); return res.text().then(function () {}); })
          .then(function () {
            hide(priorError); hide(errorBox);
            if (success) show(success); else show(priorSuccess);
            form.reset();
          })
          .catch(function () {
            hide(priorSuccess); hide(success);
            if (errorMsg) errorMsg.textContent = 'Something went wrong. Please try again.';
            if (errorBox) show(errorBox); else show(priorError);
          })
          .finally(function () {
            if (submit) submit.disabled = false;
            if (text) text.classList.remove('hidden');
            if (spinner) spinner.classList.add('hidden');
          });
      });
    });
  }

  function initBackToTop() {
    var button = document.querySelector('[data-back-to-top]');
    if (!button || button.__nibBackToTop) return;
    button.__nibBackToTop = true;
    function update() { button.hidden = window.scrollY < 500; }
    window.addEventListener('scroll', update, { passive: true });
    button.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    update();
  }

  ready(function () { initHeader(); initSocial(); initNewsletterForms(); initBackToTop(); });
})();
`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
