export const meta = {
  title: 'Something went wrong',
  description: 'An unexpected error occurred while loading this page.',
}

export default function ServerErrorPage() {
  return (
    <div className="content-column empty-page">
      <p className="eyebrow">500</p>
      <h1>Something went wrong.</h1>
      <p>Please try again in a moment.</p>
      <a className="button button--dark" href="/">Go back home</a>
    </div>
  )
}
