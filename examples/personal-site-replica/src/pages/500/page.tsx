export const meta = {
  title: '500: Something went wrong',
  description: 'An unexpected error occurred while loading this page.',
}

export default function ServerErrorPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="mb-6 text-6xl font-bold text-ink">500</h1>
        <div className="prose-editorial mx-auto mb-8">
          <p>Something went wrong on our end. Please try again in a moment.</p>
        </div>
        <a href="/" className="primary-button primary-button--lg">
          Go back to the homepage
        </a>
      </div>
    </div>
  )
}
