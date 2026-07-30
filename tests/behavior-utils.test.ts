// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  debounce,
  later,
  loadScript,
  observeIntersections,
  observeMutations,
  on,
  reflectButtonGroup,
  setParams,
  splitTags,
  waitForElement,
} from '../src/runtime/behavior-utils'

afterEach(() => {
  vi.useRealTimers()
  document.head.replaceChildren()
  window.history.replaceState(null, '', '/')
})

describe('on', () => {
  it('binds a listener and removes it on abort', () => {
    const controller = new AbortController()
    const handler = vi.fn()
    on(window, 'custom', handler, controller.signal)
    window.dispatchEvent(new Event('custom'))
    expect(handler).toHaveBeenCalledTimes(1)

    controller.abort()
    window.dispatchEvent(new Event('custom'))
    expect(handler).toHaveBeenCalledTimes(1)
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
})

describe('setParams', () => {
  it('merges owned params and preserves unrelated params, hash, and history state', () => {
    window.history.replaceState({ keep: true }, '', '/page?existing=1#hash')
    setParams((params) => {
      params.set('q', 'nib')
      params.delete('existing')
    })
    expect(window.location.pathname).toBe('/page')
    expect(window.location.search).toBe('?q=nib')
    expect(window.location.hash).toBe('#hash')
    expect(window.history.state).toEqual({ keep: true })
  })

  it('supports push mode', () => {
    window.history.replaceState(null, '', '/page')
    setParams((params) => params.set('q', 'x'), 'push')
    expect(window.location.search).toBe('?q=x')
  })
})

describe('splitTags', () => {
  it('trims, lowercases, dedupes, and drops empties', () => {
    expect(splitTags(' Rust , rust, ,Web ')).toEqual(['rust', 'web'])
    expect(splitTags('a|b|a', '|')).toEqual(['a', 'b'])
  })
})

describe('reflectButtonGroup', () => {
  it('sets aria-pressed and toggles the active class, attribute, and extra class', () => {
    const button = document.createElement('button')
    reflectButtonGroup(button, true, { extraClass: 'filter-active', attribute: 'data-active' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.classList.contains('is-selected')).toBe(true)
    expect(button.classList.contains('filter-active')).toBe(true)
    expect(button.hasAttribute('data-active')).toBe(true)

    reflectButtonGroup(button, false, { extraClass: 'filter-active', attribute: 'data-active' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.classList.contains('is-selected')).toBe(false)
    expect(button.classList.contains('filter-active')).toBe(false)
    expect(button.hasAttribute('data-active')).toBe(false)
  })
})

describe('loadScript', () => {
  it('dedupes concurrent loads for the same src', async () => {
    const controller = new AbortController()
    const first = loadScript('/one.js', { signal: controller.signal })
    const second = loadScript('/one.js', { signal: controller.signal })
    expect(first).toBe(second)
    expect(document.querySelectorAll('script[src="/one.js"]')).toHaveLength(1)
    document.querySelector<HTMLScriptElement>('script[src="/one.js"]')!
      .dispatchEvent(new Event('load'))
    await expect(first).resolves.toBeUndefined()
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
})
