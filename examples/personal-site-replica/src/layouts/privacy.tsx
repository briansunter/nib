import { type PageLayoutProps } from '@briansunter/nib'

interface PrivacyFrontmatter {
  title?: string
  description?: string
}

export default function PrivacyLayout({ children }: PageLayoutProps<PrivacyFrontmatter>) {
  return (
    <div className="privacy-page">
      <h1>Privacy Policy</h1>
      {children}
    </div>
  )
}
