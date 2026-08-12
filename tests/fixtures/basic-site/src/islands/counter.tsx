import { useState } from 'react'
import { island } from '@briansunter/nib/react'
import './counter.css'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}

export default island(Counter, { when: 'load' })
