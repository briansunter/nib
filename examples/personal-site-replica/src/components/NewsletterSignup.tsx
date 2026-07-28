import { siteHref } from '@briansunter/nib'
import { NEWSLETTER_API } from '../lib/site'

export function NewsletterSignup({
  title = 'Subscribe to newsletter',
  description = "I send occasional emails about new blog posts, side projects, and things I'm learning.",
  site = 'newsletter',
}: {
  title?: string
  description?: string
  site?: string
}) {
  return (
    <div className="newsletter-signup w-full font-sans">
      <div className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
        <h2 className="text-center text-lg font-semibold tracking-tight text-ink sm:text-xl">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-center text-sm leading-snug text-ink-secondary">{description}</p>
        <form
          className="mt-4 flex flex-col gap-2 sm:mx-auto sm:max-w-md sm:flex-row"
          data-api-url={NEWSLETTER_API}
          data-site={site}
          data-newsletter-form
        >
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            aria-label="Email address"
            data-newsletter-email
            className="form-input form-input--surface sm:flex-1"
          />
          <button type="submit" data-newsletter-submit className="primary-button w-full sm:w-auto">
            <span data-newsletter-button-text>Subscribe</span>
            <svg
              data-newsletter-button-spinner
              className="hidden h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </button>
        </form>
        <p className="mt-2.5 text-center text-xs text-ink-muted">
          By subscribing, you agree to our{' '}
          <a
            href={siteHref('/privacy')}
            data-umami-event="newsletter_privacy_click"
            data-umami-event-source={site}
            className="underline transition-colors hover:text-ink-secondary"
          >
            Privacy Policy
          </a>.
        </p>
        <div
          data-newsletter-success
          role="status"
          aria-live="polite"
          className="status-box-success mx-auto mt-4 hidden max-w-md rounded-lg p-3"
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">You&apos;re on the list!</p>
          </div>
        </div>
        <div data-newsletter-error role="alert" className="status-box-danger mx-auto mt-4 hidden max-w-md rounded-lg p-3">
          <div className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p data-newsletter-error-message className="text-sm font-medium">Please try again.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
