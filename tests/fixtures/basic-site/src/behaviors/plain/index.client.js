export default (root, signal) => {
  const button = root.querySelector('button')
  button?.addEventListener('click', () => {
    button.dataset.clicked = 'true'
  }, { signal })
}
