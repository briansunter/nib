import { Image } from '@briansunter/nib-images'
import { siteHref, type PageProps } from '@briansunter/nib'
import type config from '../../nib.config'
import { Newsletter } from '../components/Newsletter'
import { PostList } from '../components/PostList'
import { SectionHeading } from '../components/SectionHeading'
import ThemeToggle from '../islands/theme-toggle'
import { avatar } from '../data/images'

export const meta = {
  title: 'Home',
  description: 'Software engineer, entrepreneur, and AI enthusiast.',
}

export default function HomePage({ collections }: PageProps<typeof config>) {
  return (
    <div className="home-page page-stack">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">Software engineer / entrepreneur / AI enthusiast</p>
          <h1>Ideas become more useful when they leave the notebook.</h1>
          <p className="lead">I build small tools, write about the systems behind them, and keep a visual record of the things that make a life feel textured.</p>
          <div className="hero-actions">
            <a className="button button--dark" href={siteHref('/projects')}>See the projects</a>
            <a className="text-link" href={siteHref('/about')}>A little more about me →</a>
          </div>
          <ThemeToggle hydrate="load" />
        </div>
        <div className="home-hero__portrait">
          <Image
            src={avatar}
            alt="Brian Sunter"
            layout="fixed"
            width={208}
            densities={[1, 2]}
            priority
            className="avatar"
          />
          <span className="portrait-caption">Honolulu, HI / making and noticing</span>
        </div>
      </section>

      <section className="content-column">
        <SectionHeading title="Writing" href="/notes" linkLabel="View archive" />
        <PostList posts={collections.posts.slice(0, 3)} />
      </section>

      <Newsletter />

      <section className="home-links content-column">
        <SectionHeading title="A few other rooms" />
        <div className="room-grid">
          <a href={siteHref('/recipes')}><span className="eyebrow">Kitchen</span><strong>Recipes in plain text</strong><span>Cooklang-inspired notes with a tiny serving scaler.</span></a>
          <a href={siteHref('/art')}><span className="eyebrow">Studio</span><strong>Art and field drawings</strong><span>Small observations from San Francisco and Hawaii.</span></a>
          <a href={siteHref('/photos')}><span className="eyebrow">Archive</span><strong>Photos and places</strong><span>A responsive gallery sample with original dimensions preserved.</span></a>
        </div>
      </section>
    </div>
  )
}
