import { defineIsland } from '@briansunter/nib'
import { useState } from 'react'

function ReadingGoalComponent({ initial }: { initial: number }) {
  const [saved, setSaved] = useState(initial)

  return (
    <div className="reading-goal">
      <p><strong>{saved}</strong> sample notes saved for later.</p>
      <button type="button" onClick={() => setSaved((value) => value + 1)}>
        Save another
      </button>
    </div>
  )
}

export default defineIsland('reading-goal', ReadingGoalComponent)
