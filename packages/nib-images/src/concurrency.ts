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

/** Runs a bounded set of workers, stops scheduling after the first failure,
 * and waits for already-started work before rejecting. */
export async function mapWithConcurrency<Value>(
  values: readonly Value[],
  concurrency: number,
  callback: (value: Value) => Promise<void>,
): Promise<void> {
  let next = 0
  let failed = false
  let firstFailure: unknown
  const workers = Array.from({ length: Math.min(values.length, concurrency) }, async () => {
    while (!failed && next < values.length) {
      const current = values[next++]
      if (current === undefined) continue
      try {
        await callback(current)
      } catch (error) {
        if (!failed) {
          failed = true
          firstFailure = error
        }
      }
    }
  })
  await Promise.all(workers)
  if (failed) throw firstFailure
}
