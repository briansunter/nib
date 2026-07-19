export function createTaskQueue(
  concurrency: number,
  onActive?: (active: number) => void,
) {
  let active = 0
  const waiting: Array<() => void> = []
  const acquire = async () => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => waiting.push(resolve))
    } else {
      active += 1
    }
    onActive?.(active)
  }
  const release = () => {
    const next = waiting.shift()
    if (next === undefined) active -= 1
    else next()
  }
  return async <Value>(work: () => Promise<Value>): Promise<Value> => {
    await acquire()
    try {
      return await work()
    } finally {
      release()
    }
  }
}
