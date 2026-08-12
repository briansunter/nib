import { enhance } from '@briansunter/nib'

export const meta = { title: 'Enhanced' }

export default function EnhancedPage() {
  return (
    <>
      <div {...enhance('reveal')}>
        <button type="button">Toggle details</button>
        <p data-panel="" hidden>Server-rendered details.</p>
      </div>
      <button {...enhance('plain', { when: 'visible' })} type="button">
        Plain JavaScript enhancement
      </button>
    </>
  )
}
