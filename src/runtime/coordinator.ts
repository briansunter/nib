export interface ClientRuntimeController {
  mount(root?: ParentNode): void
  unmount(root?: ParentNode): void
  destroy(): void
}

const controllers = new Set<ClientRuntimeController>()

export function registerClientRuntime(controller: ClientRuntimeController): () => void {
  controllers.add(controller)
  return () => controllers.delete(controller)
}

export function mountClientRuntimes(root: ParentNode = document): void {
  for (const controller of controllers) controller.mount(root)
}

export function unmountClientRuntimes(root: ParentNode = document): void {
  for (const controller of controllers) controller.unmount(root)
}

export function destroyClientRuntimes(): void {
  for (const controller of controllers) controller.destroy()
  controllers.clear()
}
