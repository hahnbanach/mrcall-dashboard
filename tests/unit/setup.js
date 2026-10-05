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
