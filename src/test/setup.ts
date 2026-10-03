import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom has no layout; CodeMirror measures text through Range rects.
if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects ??= () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
}
