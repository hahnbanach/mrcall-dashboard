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
