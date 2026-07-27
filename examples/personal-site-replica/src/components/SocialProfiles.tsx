import { homeSocials } from '../lib/site'
import { SocialGlyph } from './icons'

const HIDDEN_GROUP_ID = 'social-profiles-more'

/**
 * Connect section for the homepage. Mirrors SocialProfiles.astro (showAll):
 * six visible social pills, with the rest revealed by a "More" toggle.
 */
export function SocialProfiles() {
  const all = homeSocials()
  const visible = all.slice(0, 6)
  const hidden = all.slice(6)

  return (
    <section className="social-section">
      <h2 className="mb-6 text-xl font-semibold text-ink-secondary lg:text-2xl">Connect</h2>
      <div className="social-grid" data-social-profiles>
        {visible.map((social) => (
          <a
            key={social.name}
            href={social.url}
            target={social.external ? '_blank' : undefined}
            rel={social.external ? 'noopener noreferrer' : undefined}
            aria-label={`Visit ${social.name}`}
            className="social-link group"
          >
            <SocialGlyph name={social.icon} className="social-icon" />
            <span className="social-label">{social.label}</span>
          </a>
        ))}
        {hidden.length > 0 && (
          <>
            <div id={HIDDEN_GROUP_ID} className="social-hidden-group" hidden>
              {hidden.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target={social.external ? '_blank' : undefined}
                  rel={social.external ? 'noopener noreferrer' : undefined}
                  aria-label={`Visit ${social.name}`}
                  className="social-link group"
                >
                  <SocialGlyph name={social.icon} className="social-icon" />
                  <span className="social-label">{social.label}</span>
                </a>
              ))}
            </div>
            <button
              type="button"
              className="social-more-button"
              aria-expanded="false"
              aria-controls={HIDDEN_GROUP_ID}
              data-more-label={`More +${hidden.length}`}
              data-less-label="Less"
              data-social-more
            >
              More +{hidden.length}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
