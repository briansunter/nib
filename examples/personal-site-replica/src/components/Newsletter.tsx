import { siteHref } from '@briansunter/nib'
import { NEWSLETTER_API } from '../lib/site'

const TITLE = 'Subscribe to newsletter'
const DESCRIPTION =
  "I send occasional emails about new blog posts, side projects, and things I'm learning."

function Spinner() {
  return (
    <svg data-newsletter-button-spinner className="hidden h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/**
 * Inline newsletter signup box. Mirrors NewsletterSignup.astro; the submit
 * flow (spinner / success / error) is driven by the shell behavior script via
 * the data-newsletter-* hooks.
 */
export function Newsletter() {
  return (
    <div className="newsletter-signup w-full font-sans">
      <div className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
        <h2 className="text-center text-lg font-semibold tracking-tight text-ink sm:text-xl">{TITLE}</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-center text-sm leading-snug text-ink-secondary">{DESCRIPTION}</p>

        <form
          className="mx-auto mt-4 flex max-w-md flex-col gap-2 sm:flex-row"
          data-api-url={NEWSLETTER_API}
          data-site="newsletter"
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
            <Spinner />
          </button>
        </form>

        <p className="mt-2.5 text-center text-xs text-ink-muted">
          By subscribing, you agree to our{' '}
          <a href={siteHref('/privacy')} className="underline transition-colors hover:text-ink-secondary">
            Privacy Policy
          </a>
          .
        </p>

        <div
          data-newsletter-success
          role="status"
          aria-live="polite"
          className="mx-auto mt-4 hidden max-w-md rounded-lg bg-[var(--color-success-subtle)] p-3 text-[var(--color-success)]"
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">You&apos;re on the list!</p>
          </div>
        </div>

        <div
          data-newsletter-error
          role="alert"
          className="mx-auto mt-4 hidden max-w-md rounded-lg bg-[var(--color-danger-subtle)] p-3 text-[var(--color-danger)]"
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p data-newsletter-error-message className="text-sm font-medium">Please try again.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
