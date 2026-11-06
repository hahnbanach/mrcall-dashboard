/**
 * How much of a call's id is shown (brief docs/briefs/2026-11-06-call-id-copy.md).
 *
 * The id is StarChat's conversation id exactly as it arrives, and it has no fixed format: `CON-<uuid>` on Vonage
 * calls, the bridge's session id on the other channels (a plain UUID, `sanitization-<uuid>`, `voice-sample-N`). So
 * the rule reads no prefix. Each id shows its first 16 characters; where ids drawn together share more than that,
 * each of those shows up to the first character that tells it apart from the others. Measured on random UUIDs, 16
 * characters never collided in a list of 200 with `CON-` or no prefix, and collided in a quarter of the lists of 50
 * behind a 13-character prefix such as `sanitization-`: the extension exists for those.
 *
 * Only the shown length is computed here. The whole id is always in the page, clipped by the component, so what is
 * selected, read aloud or copied is never the shortened text.
 */

export const CALL_ID_MIN = 16

/** The length of the prefix two strings share. */
function common (a, b) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * A Map from each distinct id of `ids` to its shown length: at least `min`, more where another id of the list shares
 * the first `min` characters (one past the longest prefix it shares with any other), never more than the id itself.
 * Duplicates count once; empty and non-string ids are skipped.
 */
export function shortIds (ids, min = CALL_ID_MIN) {
  const distinct = [...new Set((ids || []).filter((id) => typeof id === 'string' && id.length > 0))].sort()
  const lengths = new Map()
  distinct.forEach((id, i) => {
    // sorted, the id sharing the longest prefix with this one is one of its two neighbours
    const shared = Math.max(i > 0 ? common(id, distinct[i - 1]) : 0, i < distinct.length - 1 ? common(id, distinct[i + 1]) : 0)
    lengths.set(id, Math.min(id.length, Math.max(min, shared + 1)))
  })
  return lengths
}

/**
 * Whether an id shown at `length` characters is cut, and so carries an ellipsis. One character more than `length`
 * is not cut: the ellipsis would take that character's room, so the id shows whole instead.
 */
export function truncated (id, length) {
  return typeof id === 'string' && length + 1 < id.length
}
