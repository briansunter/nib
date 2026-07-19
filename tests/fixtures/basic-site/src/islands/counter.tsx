import { defineIsland } from '@briansunter/nib'

function Counter({ initialCount }: { initialCount: number }) {
  return <button type="button">Count: {initialCount}</button>
}

export default defineIsland('counter', Counter)
