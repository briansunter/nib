import { siteHref } from '@briansunter/nib'

export const NEWSLETTER_LINK = 'https://newsletter.briansunter.com'
export const NEWSLETTER_API = 'https://subs.briansunter.com/api/signup'
export const SITE_TAGLINE = 'Technology, productivity, and creativity.'
export const PGP_KEY_URL = 'https://briansunter.com/pubkey.txt'

export type SocialIcon = 'email' | 'x' | 'github' | 'linkedin' | 'rss' | 'youtube' | 'instagram' | 'threads' | 'bluesky' | 'mastodon' | 'bitcoin' | 'nostr' | 'matrix' | 'pgp' | 'coffee'

export interface SocialProfile {
  name: string
  label: string
  url: string
  icon: SocialIcon
  external: boolean
}

const external = (url: string) => !url.startsWith('/') && !url.startsWith('mailto:')

function profile(name: string, url: string, icon: SocialIcon, label?: string): SocialProfile {
  return { name, label: label ?? name, url, icon, external: external(url) }
}

export const SOCIAL_PROFILES: SocialProfile[] = [
  profile('Email', 'mailto:public@briansunter.com', 'email'),
  profile('X', 'https://twitter.com/bsunter', 'x'),
  profile('GitHub', 'https://github.com/briansunter', 'github'),
  profile('LinkedIn', 'https://www.linkedin.com/in/briansunter/', 'linkedin'),
  profile('RSS', 'https://briansunter.com/index.xml', 'rss'),
  profile('YouTube', 'https://www.youtube.com/channel/UC4Nu4dncIcTC1DyOG5XG2Vg', 'youtube'),
  profile('Instagram', 'https://www.instagram.com/bsunter/', 'instagram'),
  profile('Threads', 'https://threads.net/@bsunter', 'threads'),
  profile('BlueSky', 'https://bsky.app/profile/briansunter.com', 'bluesky'),
  profile('Mastodon', 'https://mastodon.social/@bsunter', 'mastodon'),
  profile('Bitcoin', siteHref('/bitcoin'), 'bitcoin'),
  profile('Nostr', 'https://primal.net/p/npub1ea7rsjwwxf8m439s33neffqx4z56hehuyln9ccsxrvcrdntgdersd05rxk', 'nostr'),
  profile('Matrix', 'https://matrix.to/#/@bsunter:matrix.org', 'matrix'),
  profile('Public Key', PGP_KEY_URL, 'pgp', 'PGP Key'),
  profile('Buy Coffee', 'https://buymeacoffee.com/bsunter', 'coffee', 'Coffee'),
]

export const FOOTER_SOCIAL_NAMES = ['Email', 'X', 'GitHub', 'LinkedIn', 'BlueSky']

// Curated visual order for the homepage Connect section (matches the
// reference SocialProfiles `orderedIcons` list).
const HOME_SOCIAL_ORDER = [
  'Email', 'X', 'GitHub', 'LinkedIn', 'RSS', 'YouTube',
  'Instagram', 'Threads', 'BlueSky', 'Mastodon', 'Bitcoin',
  'Nostr', 'Matrix', 'Public Key', 'Buy Coffee',
]

export function isExternalLink(url: string): boolean {
  return !url.startsWith('/') && !url.startsWith('#') && !url.startsWith('mailto:')
}

export function socialByName(name: string): SocialProfile | undefined {
  return SOCIAL_PROFILES.find((profile) => profile.name === name)
}

export function footerSocials(): SocialProfile[] {
  return FOOTER_SOCIAL_NAMES.map(socialByName).filter((s): s is SocialProfile => Boolean(s))
}

/** Ordered social profiles for the homepage Connect grid. */
export function homeSocials(): SocialProfile[] {
  return HOME_SOCIAL_ORDER
    .map(socialByName)
    .filter((s): s is SocialProfile => Boolean(s))
}
