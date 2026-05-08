import '@testing-library/jest-dom'

// jsdom doesn't ship ResizeObserver; recharts' ResponsiveContainer needs it
// to measure parent width. Without this polyfill, charts render as empty divs in tests.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock

// ResponsiveContainer measures parent client/offset dimensions on mount. jsdom
// returns 0 for those, so recharts skips rendering. Force non-zero dimensions
// so charts paint their SVG and tests can assert on it.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return 400
  },
})
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 300
  },
})
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return 400
  },
})
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return 300
  },
})
