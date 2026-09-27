import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver, which Headless UI's anchored menus rely on to
// position themselves. Nothing is measured in tests, so a no-op is enough.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom also has no Web Animations API. Headless UI polyfills it and warns on
// every transition; returning no running animations makes transitions resolve
// immediately, which is what tests want anyway.
Element.prototype.getAnimations ??= () => []
