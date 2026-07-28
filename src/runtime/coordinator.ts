export interface ClientRuntimeController {
  mount(root?: ParentNode): void
  unmount(root?: ParentNode): void
  destroy(): void
}

const controllers = new Set<ClientRuntimeController>()

function finishCleanup(action: string, failures: unknown[]): void {
  if (failures.length > 0) {
    throw new AggregateError(failures, `Nib client runtime ${action} failed`)
  }
}

export function registerClientRuntime(controller: ClientRuntimeController): () => void {
  controllers.add(controller)
  return () => controllers.delete(controller)
}

export function mountClientRuntimes(root: ParentNode = document): void {
  for (const controller of controllers) controller.mount(root)
}

export function unmountClientRuntimes(root: ParentNode = document): void {
  const failures: unknown[] = []
  for (const controller of [...controllers].reverse()) {
    try {
      controller.unmount(root)
    } catch (error) {
      failures.push(error)
    }
  }
  finishCleanup('unmount', failures)
}

export function destroyClientRuntimes(): void {
  const registered = [...controllers].reverse()
  controllers.clear()
  const failures: unknown[] = []
  for (const controller of registered) {
    try {
      controller.destroy()
    } catch (error) {
      failures.push(error)
    }
  }
  finishCleanup('destroy', failures)
}
