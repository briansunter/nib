import { Behavior, definePage, siteHref } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type config from '../../nib.config'
import fieldNotes from '../assets/images/field-notes.jpg?nib-image'

export const meta = {
  title: 'Field notes for curious people',
  description: 'A small fictional publication built with Nib.',
}

export default definePage<typeof config>(function HomePage({ collections }) {
  const [latest, ...morePosts] = collections.posts

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A sample Nib publication</p>
          <h1>Ideas worth<br />keeping close.</h1>
          <p className="lede">
            Commonplace is a small fictional journal about creative practice,
            better questions, and paying attention.
          </p>
        </div>
        <Image
          alt="An abstract wash of violet and coral light"
          className="hero-image"
          layout="full"
          maxWidth={960}
          priority
          src={fieldNotes}
          widths={[320, 640, 960]}
          sizes="(min-width: 900px) 42vw, calc(100vw - 2rem)"
        />
      </section>

      {latest ? (
        <section className="latest-note">
          <div>
            <p className="eyebrow">Latest note</p>
            <h2><a href={siteHref(latest.data.path)}>{latest.data.title}</a></h2>
            <p>{latest.data.description}</p>
          </div>
          <time dateTime={latest.data.date}>{latest.data.date}</time>
        </section>
      ) : null}

      <section aria-labelledby="more-notes" className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">From the notebook</p>
            <h2 id="more-notes">Recent field notes</h2>
          </div>
          <a className="text-link" href={siteHref('/posts/')}>
            All posts <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="post-grid">
          {morePosts.map(({ id, data }) => (
            <article className="post-card" key={id}>
              <time dateTime={data.date}>{data.date}</time>
              <h3>
                <a data-nib-prefetch="hover" href={siteHref(data.path)}>
                  {data.title}
                </a>
              </h3>
              <p>{data.description}</p>
              <ul aria-label="Topics">
                {data.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="topic-guides" className="section topic-section">
        <div>
          <p className="eyebrow">Typed data pages</p>
          <h2 id="topic-guides">Topic guides</h2>
        </div>
        <div className="topic-links">
          {collections.topics.map(({ id, data }) => (
            <a href={siteHref(`/topics/${data.slug}/`)} key={id}>
              <strong>{data.title}</strong>
              <span>{data.description}</span>
            </a>
          ))}
        </div>
      </section>

      <Behavior name="reading-goal">
        <div className="reading-goal" data-saved="2">
          <p><strong data-saved-count="">2</strong> sample notes saved for later.</p>
          <button type="button">Save another</button>
        </div>
      </Behavior>
    </>
  )
})
