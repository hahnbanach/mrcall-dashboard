import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * Component tests, and only them: the application is built by vue-cli (webpack) and nothing here
 * touches that. Vitest needs a vite config of its own to compile single-file components, so this
 * file exists to say three things and no more — how to compile a `.vue`, what `@` means, and that
 * the tests run in a DOM.
 *
 * `.mjs` because the project is CommonJS and `@vitejs/plugin-vue` is ESM only: as `vitest.config.js`
 * it is loaded with `require` and fails before a single test runs.
 *
 * WHY THEY WERE ADDED. The skills screen is one 1 500-line component that renders every field type
 * in one chain, and it is about to be taken apart into one component per widget so that adding a
 * skill does not mean editing everything. There were 26 Playwright specs and not one of them opened
 * that screen, so the refactor had no net at all: a field that stopped saving would have been found
 * by a customer. A component test per widget is the net, and it is per widget precisely so that
 * adding the next one does not ask anybody to re-run the others in their head.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    // Only the component tests: `tests/e2e` is Playwright's, and Playwright and Vitest both define
    // `test`, so a stray import of one into the other fails in a way nobody enjoys reading.
    include: ['tests/unit/**/*.spec.js'],
    globals: true
  }
})
