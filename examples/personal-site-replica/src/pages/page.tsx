import type { PageProps } from '@briansunter/nib'
import type config from '../../nib.config'
import { AboutSection } from '../components/AboutSection'
import { BlogList } from '../components/BlogList'
import { Newsletter } from '../components/Newsletter'
import { PageFrame } from '../components/PageFrame'
import { SocialProfiles } from '../components/SocialProfiles'

export const meta = {
  description: 'Software engineer, entrepreneur, and AI enthusiast.',
}

export default function HomePage({ collections }: PageProps<typeof config>) {
  // Newest-first writing entries; the homepage shows the first nine.
  const posts = [...collections.writing]
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 9)
    .map((entry) => entry.data)

  return (
    <PageFrame>
      <div className="flex flex-col gap-16 lg:gap-24" data-pagefind-ignore>
        <AboutSection />
        <SocialProfiles />
        <section className="mx-auto w-full max-w-4xl">
          <Newsletter />
        </section>
        <BlogList posts={posts} />
      </div>
    </PageFrame>
  )
}
