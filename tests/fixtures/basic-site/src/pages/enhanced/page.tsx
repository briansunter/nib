import { defineClientBehavior } from '@briansunter/nib'

const Reveal = defineClientBehavior<{ label: string }>('reveal')

export const meta = { title: 'Enhanced' }

export default function EnhancedPage() {
  return (
    <Reveal props={{ label: 'Details' }}>
      <button type="button">Toggle details</button>
      <p data-panel="" hidden>Server-rendered details.</p>
    </Reveal>
  )
}
