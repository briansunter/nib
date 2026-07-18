import { useState } from 'react'
import { defineIsland } from '../framework/islands'

interface CounterProps {
  initialCount: number
}

function Counter({ initialCount }: CounterProps) {
  const [count, setCount] = useState(initialCount)
  return (
    <button
      className="rounded-lg bg-white px-4 py-2 font-medium text-slate-950"
      type="button"
      onClick={() => setCount((value) => value + 1)}
    >
      Count: {count}
    </button>
  )
}

export default defineIsland('counter', Counter)
