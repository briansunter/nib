export const meta = {
  title: '404: Page Not Found',
  description: "Oops! The page you're looking for doesn't exist.",
}

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="mb-6 text-6xl font-bold text-ink">404</h1>
        <div className="prose-editorial mx-auto mb-8">
          <p>The page you are looking for does not exist.</p>
        </div>
        <a href="/" className="primary-button primary-button--lg">
          Go back to the homepage
        </a>
      </div>
    </div>
  )
}
