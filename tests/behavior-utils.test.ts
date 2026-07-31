// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  debounce,
  later,
  loadScript,
  observeIntersections,
  observeMutations,
  onScroll,
  waitForElement,
} from '../src/runtime/behavior-utils'

afterEach(() => {
  vi.useRealTimers()
  document.head.replaceChildren()
})

describe('onScroll', () => {
  it('cancels a queued frame and guards the callback on abort', () => {
    const controller = new AbortController()
    const handler = vi.fn()
    let callback: FrameRequestCallback | undefined
    const request = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((next) => {
        callback = next
        return 17
      })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    onScroll(handler, controller.signal)
    window.dispatchEvent(new Event('scroll'))
    expect(request).toHaveBeenCalledOnce()

    controller.abort()
    expect(cancel).toHaveBeenCalledWith(17)
    callback?.(0)
    expect(handler).not.toHaveBeenCalled()
    request.mockRestore()
    cancel.mockRestore()
  })
})

describe('debounce', () => {
  it('fires once after the delay and clears on abort', () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fn = vi.fn()
    const trigger = debounce(fn, 100, controller.signal)

    trigger()
    trigger()
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)

    controller.abort()
    trigger()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('later', () => {
  it('fires after the delay and cancels on abort', () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fn = vi.fn()
    const cancel = later(fn, 50, controller.signal)

    controller.abort()
    cancel()
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })

  it('does not schedule when the signal is already aborted', () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    controller.abort()
    const fn = vi.fn()
    later(fn, 50, controller.signal)
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('observeMutations', () => {
  it('disconnects on abort', () => {
    const controller = new AbortController()
    const callback = vi.fn()
    const observer = observeMutations(document.body, callback, { childList: true }, controller.signal)
    const disconnect = vi.spyOn(observer, 'disconnect')
    controller.abort()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('observeIntersections', () => {
  it('disconnects on abort', () => {
    const controller = new AbortController()
    const callback = vi.fn()
    const target = document.createElement('div')
    const observer = observeIntersections(target, callback, {}, controller.signal)
    const disconnect = vi.spyOn(observer, 'disconnect')
    controller.abort()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('waitForElement', () => {
  it('resolves an existing element immediately', async () => {
    const controller = new AbortController()
    document.body.innerHTML = '<span class="target"></span>'
    const element = await waitForElement(document.body, '.target', controller.signal)
    expect(element).toBeInstanceOf(HTMLSpanElement)
  })

  it('resolves an element inserted later and rejects on abort', async () => {
    const controller = new AbortController()
    const pending = waitForElement<Element>(document.body, '.late', controller.signal)
    const span = document.createElement('span')
    span.className = 'late'
    document.body.append(span)
    await expect(pending).resolves.toBe(span)

    const controller2 = new AbortController()
    const aborting = waitForElement(document.body, '.never', controller2.signal)
    controller2.abort()
    await expect(aborting).rejects.toBeDefined()
  })

  it('rejects immediately when already aborted and disconnects after success', async () => {
    const aborted = new AbortController()
    aborted.abort()
    await expect(waitForElement(document.body, '.existing', aborted.signal))
      .rejects.toBeDefined()

    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const controller = new AbortController()
    const pending = waitForElement(document.body, '.eventual', controller.signal)
    const span = document.createElement('span')
    span.className = 'eventual'
    document.body.append(span)
    await expect(pending).resolves.toBe(span)
    expect(disconnect).toHaveBeenCalled()
    disconnect.mockRestore()
  })
})

describe('loadScript', () => {
  it('dedupes concurrent loads for the same src', async () => {
    const controller = new AbortController()
    const first = loadScript('/one.js', { signal: controller.signal })
    const second = loadScript('/one.js', { signal: controller.signal })
    // Each caller gets its own abort-aware promise while the underlying
    // script request remains shared.
    expect(first).not.toBe(second)
    expect(document.querySelectorAll('script[src="/one.js"]')).toHaveLength(1)
    document.querySelector<HTMLScriptElement>('script[src="/one.js"]')!
      .dispatchEvent(new Event('load'))
    await expect(first).resolves.toBeUndefined()
    const laterController = new AbortController()
    const later = loadScript('/one.js', { signal: laterController.signal })
    await expect(later).resolves.toBeUndefined()
    expect(document.querySelectorAll('script[src="/one.js"]')).toHaveLength(1)
  })

  it('rejects on error and rejects on abort', async () => {
    const errorController = new AbortController()
    const failing = loadScript('/fail.js', { signal: errorController.signal })
    document.querySelector<HTMLScriptElement>('script[src="/fail.js"]')!
      .dispatchEvent(new Event('error'))
    await expect(failing).rejects.toThrow('Failed to load script')

    const abortController = new AbortController()
    const aborting = loadScript('/abort.js', { signal: abortController.signal })
    abortController.abort()
    await expect(aborting).rejects.toBeDefined()
  })

  it('keeps the shared request alive when one caller aborts', async () => {
    const firstController = new AbortController()
    const secondController = new AbortController()
    const first = loadScript('/shared.js', { signal: firstController.signal })
    const second = loadScript('/shared.js', { signal: secondController.signal })
    firstController.abort()
    await expect(first).rejects.toBeDefined()
    document.querySelector<HTMLScriptElement>('script[src="/shared.js"]')!
      .dispatchEvent(new Event('load'))
    await expect(second).resolves.toBeUndefined()
  })
})
