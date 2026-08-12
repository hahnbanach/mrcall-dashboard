export const PKCEUtils = {
  /**
   * Random string from the PKCE unreserved character set (RFC 7636 §4.1).
   *
   * Drawn from crypto.getRandomValues, not Math.random: Math.random is not
   * cryptographically secure and its output is predictable from previous values in
   * some engines. A guessable code verifier defeats the point of PKCE, since an
   * attacker who intercepts an authorization code could then redeem it.
   *
   * Rejection sampling keeps the distribution uniform. The set has 66 characters,
   * which does not divide 256, so a plain byte modulo would favour the first 58 of
   * them; bytes at or above the largest multiple of 66 are discarded instead.
   */
  generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    const limit = Math.floor(256 / possible.length) * possible.length
    let text = ''
    while (text.length < length) {
      const bytes = new Uint8Array(length - text.length)
      crypto.getRandomValues(bytes)
      for (const b of bytes) {
        if (b < limit) text += possible.charAt(b % possible.length)
      }
    }
    return text
  },

  async generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return this.base64UrlEncode(digest)
  },

  base64UrlEncode(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
}
