export const meta = { title: 'Not found', description: 'That page does not exist.' }

export default function NotFoundPage() {
  return (
    <div className="content-column empty-page">
      <p className="eyebrow">404</p>
      <h1>That page wandered off.</h1>
      <p>Try the home page, writing archive, or projects index.</p>
      <a className="button button--dark" href="/">Go home</a>
    </div>
  )
}
