import { Image } from '@briansunter/nib-images'
import { avatar } from '../data/images'

const ABOUT_HEADER = 'Software Engineer, Entrepreneur, AI Enthusiast'
const ABOUT_BODY =
  "I'm a software engineer experienced in web development, mobile apps, public cloud architecture, and DevOps. I'm currently learning about AI and building AI products."

/** Homepage hero. Mirrors AboutSection.astro: responsive avatar + header + dek. */
export function AboutSection() {
  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="grid w-full min-w-0 grid-cols-[auto_1fr] gap-x-6 gap-y-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-12 sm:gap-y-6">
        <div className="row-start-1 self-center sm:row-span-2">
          <Image
            src={avatar}
            alt="Brian Sunter"
            layout="fixed"
            width={208}
            densities={[1, 2]}
            priority
            className="ml-2 h-20 w-20 shrink-0 rounded-full border border-border object-cover sm:ml-0 sm:h-44 sm:w-44 lg:h-52 lg:w-52"
          />
        </div>
        <h1 className="min-w-0 self-center text-2xl font-bold leading-tight tracking-tight text-ink sm:self-end sm:text-h1">
          {ABOUT_HEADER}
        </h1>
        <div className="dek col-span-2 max-w-2xl text-left text-base sm:col-span-1 sm:self-start sm:text-lg lg:text-xl">
          <p>{ABOUT_BODY}</p>
        </div>
      </div>
    </section>
  )
}
