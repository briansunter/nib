import Counter from '../../islands/counter'

export const meta = { title: 'Island' }

export default function IslandPage() {
  return (
    <main>
      <h1>React island</h1>
      <Counter initialCount={3} />
    </main>
  )
}
