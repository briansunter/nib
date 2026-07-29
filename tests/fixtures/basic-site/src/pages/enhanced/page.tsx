import { Behavior } from '@briansunter/nib'

export const meta = { title: 'Enhanced' }

export default function EnhancedPage() {
  return (
    <>
      <Behavior name="reveal" props={{ label: 'Details' }}>
        <button type="button">Toggle details</button>
        <p data-panel="" hidden>Server-rendered details.</p>
      </Behavior>
      <Behavior name="plain">
        <button type="button">Plain JavaScript behavior</button>
      </Behavior>
    </>
  )
}
