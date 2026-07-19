import Counter from '../islands/counter'

export const meta = {
  title: 'Home',
  description: 'Journal home.',
}

export default function HomePage() {
  return <><h1>Journal home</h1><Counter initialCount={2} /></>
}
