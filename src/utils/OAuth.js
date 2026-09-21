import axios from 'axios'
import { PKCEUtils } from '@/utils/PKCE'

/**
 * Scopes a sign-in may request, and nothing else.
 *
 * Google exempts an authorization request whose scopes are a subset of
 * openid/email/profile from the "unverified app" screen, from the test user
 * list, and from the 7-day refresh token expiry. That exemption is evaluated
 * per request, so it survives only as long as the login asks for exactly these
 * three and nothing widens the set behind our back (see the note on
 * include_granted_scopes in GoogleSignIn.vue).
 */
export const SIGN_IN_SCOPES = ['openid', 'email', 'profile']

/**
 * Every scope this OAuth client is allowed to request, sign-in included.
 *
 * This is not documentation, it is a mirror: it must stay identical to the
 * scope list registered on the Google Auth Platform "Data access" page for
 * VUE_APP_GOOGLE_CLIENT_ID. Google shows the unverified-app screen whenever a
 * request carries a scope that is not registered there, even a scope that was
 * verified previously, so a scope reaching an authorization URL without being
 * on this list is a bug rather than a feature that needs enabling.
 *
 * Adding one here is the second half of a change whose first half happens in
 * the Google console. Doing only this half breaks every Google flow at once.
 * See docs/integration/google-oauth.md.
 */
/* ALLOWED_SCOPES and assertScopesAllowed lived here until 2026-09-21.
 *
 * They were a copy, in this repository, of a fact about the Google project: which scopes the OAuth
 * client is registered to request. The skills ask for their scopes through the backend catalogue,
 * so a skill added in StarChat could introduce one and nothing connected the two lists until a
 * customer pressed Authorise — and when they drifted the other way the list refused a scope Google
 * had been granting since April, which is how this came down.
 *
 * The comparison now happens where both halves are known: StarChat holds the client and serves the
 * manifests, `SkillManifest.diagnoseScopes` compares them per OAuth CLIENT — Calendly and Microsoft
 * have their own — and the result travels in the `diagnostics` this screen already receives per
 * skill and used to discard. A developer-time test makes the same comparison, so a bad scope fails
 * in CI rather than in front of somebody.
 *
 * The two other callers needed nothing: the sign-in checked SIGN_IN_SCOPES against a list built
 * from SIGN_IN_SCOPES, which cannot fail, and the calendar connect checked one local constant
 * against another.
 */


const VERIFIER_KEY = 'codeVerifier'
const STATE_KEY = 'oauthState'

export const GoogleAuthFlow = {
  /**
   * Start an authorization: mint the PKCE verifier and the state, remember both,
   * and hand back what the authorization URL needs.
   *
   * The state is what ties the callback to this browser. Without it anyone can
   * feed our callback an authorization code of their own and the victim ends up
   * signed into the attacker's Google account, which is a login CSRF. Three
   * different screens start this flow, so it lives here rather than being
   * repeated in each of them.
   */
  async begin() {
    const codeVerifier = PKCEUtils.generateRandomString(128)
    const state = PKCEUtils.generateRandomString(32)
    localStorage.setItem(VERIFIER_KEY, codeVerifier)
    localStorage.setItem(STATE_KEY, state)
    return { state, codeChallenge: await PKCEUtils.generateCodeChallenge(codeVerifier) }
  },

  /**
   * Finish an authorization: check the returned state against the stored one and
   * give back the verifier. Throws if they disagree or either is missing, which
   * is the case a forged callback lands in.
   *
   * Both values are cleared whatever happens: they are single use, and leaving a
   * verifier behind would let a later forged callback reuse it.
   */
  consume(returnedState) {
    const codeVerifier = localStorage.getItem(VERIFIER_KEY)
    const expectedState = localStorage.getItem(STATE_KEY)
    localStorage.removeItem(VERIFIER_KEY)
    localStorage.removeItem(STATE_KEY)

    if (!codeVerifier) throw new Error('Missing code verifier: start the sign-in again')
    if (!expectedState) throw new Error('Missing authorization state: start the sign-in again')
    if (returnedState !== expectedState) throw new Error('Authorization state mismatch: the request did not come from this browser')
    return codeVerifier
  },

  /**
   * Trade the authorization code for tokens through the backend.
   *
   * The exchange used to happen here, in the browser, which meant shipping the
   * Google client secret in the bundle: vue-cli inlines every VUE_APP_* value, so
   * it was readable by anyone who loaded the app. Google's web client type needs
   * a secret at the token endpoint, so the exchange has to be server side and the
   * secret now lives only there.
   */
  async exchangeCode(code, codeVerifier) {
    const url = process.env.VUE_APP_STARCHAT_URL + '/mrcall/v1/mrcall0/oauth/google/token'
    const response = await axios.post(url, {
      code,
      codeVerifier,
      redirectUri: process.env.VUE_APP_GOOGLE_REDIRECT_URI
    }, { headers: { 'Content-type': 'application/json; charset=UTF-8' } })

    // Returned under the same names the Google endpoint used, so the callers that
    // destructure this keep working unchanged.
    return {
      access_token: response.data.accessToken,
      refresh_token: response.data.refreshToken,
      expires_in: response.data.expiresIn,
      scope: response.data.scope || '',
      token_type: response.data.tokenType,
      id_token: response.data.idToken
    }
  }
}

export const OAuthHelper = {
  // Four helpers used to live here: getGoogleCredentials, updateGoogleCredentials,
  // revokeAccess and revokeAllGoogleAccess. All four operated on the oauth.GOOGLE
  // record, which the sign-in stopped writing and StarChat stopped honouring, and
  // none had a caller. revokeAllGoogleAccess could not have worked in any case: it
  // called updateGoogleCredentials(user, null), which threw on a missing access
  // token before building a request.
  //
  // isTokenExpired went with them. Its one caller, the calendar store, used it to
  // decide whether a calendar counted as connected, which is not what it answers:
  // nothing client-side spends the access token, and StarChat refreshes on every
  // call from the refresh token alone. It was also unanswerable as written, reading
  // expiresAt while the server returns expirationTime.

  async getGoogleCalendarCredentials(user) {
    try {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/customer/registry?id=" + user.uid
      const response = await axios.get(url, { headers })
      const cal = response.data?.data?.oauth?.GOOGLE_CALENDAR || null
      return cal
    } catch (error) {
      console.error('Failed to get Google Calendar credentials:', error)
      return null
    }
  },

  async updateGoogleCalendarCredentials(user, credentials, calendarId = null) {
    try {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/customer/registry"

      if (!credentials) {
        // Disconnect: send null to signal the backend to revoke the provider
        const customerData = { oauth: { GOOGLE_CALENDAR: null } }
        await axios.put(url, customerData, { headers })
        return customerData
      }

      if (!credentials.accessToken) {
        throw new Error('Invalid OAuth credentials: missing access token')
      }

      const calendarData = { ...credentials }
      if (calendarId) {
        calendarData.calendarId = calendarId
      }

      const customerData = {
        oauth: {
          GOOGLE_CALENDAR: calendarData
        }
      }

      await axios.put(url, customerData, { headers })

      return customerData
    } catch (error) {
      console.error('Failed to store calendar credentials:', error)
      throw error
    }
  }

  // revokeAllGoogleAccess lived here too, with no callers, and it now could not
  // work at all: it revoked tokens it read from the endpoint, which no longer
  // returns any, and cleared them through helpers that are gone. Revoking a
  // customer's Google grant belongs on the server, which is the only side that
  // still holds the credential. Disconnecting a calendar is
  // updateGoogleCalendarCredentials(user, null) above.
}