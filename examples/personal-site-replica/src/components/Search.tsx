import { SearchBehavior } from '../client-behaviors'

export default function Search() {
  return (
    <SearchBehavior props={{}} hydrate="load">
      <link rel="stylesheet" href="/pagefind/pagefind-ui.css" />
      <div
        id="search"
        className="search-widget"
        data-pagefind-ui
        data-bundle-path="/pagefind/"
      />
    </SearchBehavior>
  )
}
