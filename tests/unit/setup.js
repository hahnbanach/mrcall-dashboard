/**
 * What jsdom lacks and the components reach for. jsdom implements no CSS media queries, so it has no
 * window.matchMedia; PrimeVue 4.5 calls it when it mounts its overlay components (Select, among
 * others), and every test that mounts one failed with "matchMedia is not a function". The stand-in
 * answers that no query matches, which is what a desktop-sized page answers for the narrow-screen
 * queries these components ask, and listens to nothing, since nothing here resizes.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener () {},
    removeListener () {},
    addEventListener () {},
    removeEventListener () {},
    dispatchEvent () { return false }
  })
}

/**
 * jsdom has Range but no layout, so Range#getClientRects and Range#getBoundingClientRect are
 * missing. CodeMirror, under the JSON widget, measures the selection with them after mounting; it
 * catches the TypeError and prints it, so a test that draws a JSON field passed with a stack trace in
 * its output. Empty rects are what a page with nothing laid out would answer; nothing here asserts on
 * a position.
 */
if (typeof Range !== 'undefined') {
  const emptyRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON () { return this } })
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = emptyRect
  }
}

/**
 * Node 25 and later have a Web Storage of their own, a global `localStorage` that is undefined unless
 * Node is started with `--localstorage-file`. Vitest copies jsdom's window onto the global object
 * but leaves alone the keys the global already has, so on those versions a test that reads
 * `localStorage` got Node's undefined instead of jsdom's storage, and the OAuth test failed with
 * "Cannot read properties of undefined (reading 'setItem')". CI runs Node 18 and never saw it. The
 * components run in a browser, so the storage the tests see is the DOM's: jsdom's, put back here
 * whenever Node's has taken its place.
 */
if (globalThis.jsdom) {
  for (const name of ['localStorage', 'sessionStorage']) {
    const domStorage = globalThis.jsdom.window[name]
    if (globalThis[name] !== domStorage) {
      Object.defineProperty(globalThis, name, { value: domStorage, configurable: true, writable: true })
    }
  }
}
