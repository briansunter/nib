export function Newsletter() {
  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div>
        <p className="eyebrow">A small signal, occasionally</p>
        <h2 id="newsletter-title">Notes on what I’m building and learning.</h2>
        <p>Occasional writing about technology, productivity, and creative practice.</p>
      </div>
      <form action="https://subs.briansunter.com/api/signup" method="post">
        <label className="sr-only" htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" required />
        <button type="submit">Subscribe</button>
      </form>
    </section>
  )
}
