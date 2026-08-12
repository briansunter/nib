export default (root, signal) => {
  root.addEventListener('click', () => {
    root.dataset.clicked = 'true'
  }, { signal })
}
