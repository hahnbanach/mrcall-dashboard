/*
 * Whether a failed request is one the Axios interceptor (./axiosConfig.js) ended the session for: it marks the error,
 * logs out and goes to sign-in, and a component that sees it shows nothing.
 *
 * WHY A MODULE OF ITS OWN. The predicate reads one flag and needs nothing; axiosConfig.js imports Firebase, the store
 * and the router to do its work. A component that imported the predicate from there could not be mounted in a unit
 * test without a Firebase configuration (four restaurant and skill specs failed at import with auth/invalid-api-key).
 * axiosConfig.js re-exports it, so both imports answer the same function.
 */
export function isSessionEnded (error) {
  return error?.sessionEnded === true
}
