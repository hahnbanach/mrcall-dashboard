import { describe, it, expect } from 'vitest'
import { publicPaths } from '../../scripts/static-routes'

/**
 * Every route needs a session unless it says it is public, and this is the list of those that say
 * so. A route made public has to be added here too: the second place is the point, because a page
 * that calls the API with the user's token and opens without one draws an empty shell (that is how
 * `/businessconfiguration` behaved until 2026-10-13, when the rule was the other way round).
 *
 * Read from the router's source, as the deploy script reads it, because importing the router
 * imports every page.
 */
describe('the public routes', () => {
  it('are exactly the pages a visitor without a session may open', () => {
    expect([...publicPaths()].sort()).toEqual([
      '/',
      '/:pathMatch(.*)*',
      '/callback',
      '/callforwardingguide',
      '/customtokenlogin',
      '/failed_payment',
      '/failed_payment_product',
      '/login',
      '/magiclink',
      '/oauth/authorize',
      '/partnerprogram',
      '/privacypolicy',
      '/signin',
      '/signup',
      '/success_payment',
      '/success_payment_product',
      '/termsandconditions'
    ])
  })
})
