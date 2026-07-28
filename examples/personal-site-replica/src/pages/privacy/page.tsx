export const meta = {
  title: 'Privacy Policy',
  description: 'Privacy policy for briansunter.com',
}

const lastUpdated = '2026-07-09'

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-3 lg:px-8 py-12">
      <h1 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-ink mb-8">
        Privacy Policy
      </h1>

      <p className="text-sm text-ink-muted mb-8">
        Last updated: {lastUpdated}
      </p>

      <div className="prose-editorial font-sans space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Overview</h2>
          <p className="text-ink-secondary leading-relaxed">
            This website (briansunter.com) is a personal blog. I respect your privacy and am committed to being transparent about any data collection. This policy explains what information is collected and how it&apos;s used.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Information Collected</h2>

          <h3 className="text-lg font-medium text-ink mt-4 mb-2">Newsletter Subscription</h3>
          <p className="text-ink-secondary leading-relaxed">
            If you subscribe to the newsletter, I collect your email address. This is used solely to send you updates about new blog posts and projects. You can unsubscribe at any time using the link in any email.
          </p>

          <h3 className="text-lg font-medium text-ink mt-4 mb-2">Analytics</h3>
          <p className="text-ink-secondary leading-relaxed">
            This site uses privacy-focused analytics to understand how visitors use the site. This helps me improve content and user experience. The analytics are anonymized and do not track individual users across sites.
          </p>
          <p className="text-ink-secondary leading-relaxed mt-2">
            Analytics may include page paths, referrer origins and paths, browser-provided location, device details, basic performance metrics, scroll depth, outbound link domains, and site interaction events such as recipe filters or project link clicks. Search terms, email addresses, URL fragments, and other sensitive free-text values are removed before analytics data is sent. I do not use analytics identity calls on this public site.
          </p>
          <p className="text-ink-secondary leading-relaxed mt-2">
            If your browser sends a Global Privacy Control (GPC) signal, analytics are disabled automatically and no usage data is collected.
          </p>

          <h3 className="text-lg font-medium text-ink mt-4 mb-2">Local browser storage</h3>
          <p className="text-ink-secondary leading-relaxed">
            This site stores a temporary light or dark theme preference in your browser&apos;s session storage. The preference expires after one hour and is not sent to the server. The site does not set advertising or cross-site tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Third-Party Services</h2>
          <p className="text-ink-secondary leading-relaxed mb-3">
            This site may embed content from third-party services:
          </p>
          <ul className="list-disc list-inside text-ink-secondary leading-relaxed space-y-1">
            <li>YouTube videos</li>
            <li>Twitter/X posts</li>
            <li>GitHub content</li>
          </ul>
          <p className="text-ink-secondary leading-relaxed mt-3">
            These embeds may set their own cookies and collect data according to their respective privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Data Retention</h2>
          <p className="text-ink-secondary leading-relaxed">
            Newsletter subscriber email addresses are retained until you unsubscribe. Analytics events are retained for site-level reporting and are not intended to include personally identifiable information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Your Rights</h2>
          <p className="text-ink-secondary leading-relaxed">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-ink-secondary leading-relaxed space-y-1 mt-2">
            <li>Unsubscribe from the newsletter at any time</li>
            <li>Request deletion of your email from the newsletter list</li>
            <li>Contact me with any privacy concerns</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Contact</h2>
          <p className="text-ink-secondary leading-relaxed">
            If you have any questions about this privacy policy or your data, please contact me at{' '}
            <a href="mailto:public@briansunter.com" className="text-accent hover:underline">
              public@briansunter.com
            </a>{' '}.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">Changes to This Policy</h2>
          <p className="text-ink-secondary leading-relaxed">
            This privacy policy may be updated from time to time. Any changes will be posted on this page with an updated revision date.
          </p>
        </section>
      </div>
    </div>
  )
}
