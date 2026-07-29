import { island } from '@briansunter/nib'

function Counter({ initialCount }: { initialCount: number }) {
  return <button type="button">Count: {initialCount}</button>
}

export default island(Counter)
