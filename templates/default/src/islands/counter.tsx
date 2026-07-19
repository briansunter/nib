import { defineIsland } from '@briansunter/nib'
import { useState } from 'react'

function CounterComponent({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}

export const Counter = defineIsland('counter', CounterComponent)
export default Counter
