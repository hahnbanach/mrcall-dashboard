/**
 * Whether a Firebase user may open a page that requires sign-in: someone signed in, not
 * anonymously, with a verified email or through Google (which verifies it).
 *
 * The router's guard and Signin both ask this. Signin sends a user back to the page the guard
 * turned away (`redirect`), and if the two answered differently the guard would send that user
 * straight back to Signin, and Signin to the page again.
 */
export function isAdmitted(user) {
  if (!user || user.isAnonymous) return false;
  const viaGoogle = Array.isArray(user.providerData) && user.providerData[0]?.providerId === 'google.com';
  return viaGoogle || user.emailVerified === true;
}
