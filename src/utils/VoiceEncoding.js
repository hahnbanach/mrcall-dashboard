/** Which audio encoding this browser should use for the direct-voice call.
 *
 * There is one right answer and it is a capability question, not a question
 * about who the user is or how wide their window is. The dashboard used to ask
 * it three different ways, in three different files, all wrong:
 *
 *   - OnboardingMakeATestCall.vue rendered `encoding="opus"` behind `isAdmin`
 *     and `encoding="pcm16"` for everyone else. So customers ran uncompressed
 *     PCM at 24 kHz — roughly 48 kB/s each way and ~187 WebSocket frames a
 *     second — while the people diagnosing the product ran Opus at about a
 *     tenth of that and 50 frames a second. The server's own throttle comment
 *     reasons about "50 packets/s", i.e. the Opus rate. That matters more than
 *     it sounds: the in-browser call IS the free trial now (the test phone
 *     number was retired), it was chosen over the phone *because the audio is
 *     better*, and the one person who could not experience the customer's audio
 *     was the one most likely to notice it was bad.
 *   - Businesses.vue used `window.innerWidth < 768`. A narrow desktop window is
 *     not a phone, and a phone with an older browser has no WebCodecs at all.
 *   - ActionPanel.vue hardcoded pcm16.
 *
 * Opus needs WebCodecs (`AudioEncoder` / `AudioDecoder`): Chrome and Edge 94+,
 * modern Android Chrome, Safari 16.4+ / iOS 16.4+. Everything older falls back
 * to pcm16, which needs only AudioWorklet and is universally available. This is
 * the same test the public website already makes in TalkToMrCallBlock.tsx —
 * kept deliberately identical, so the two surfaces cannot drift into
 * disagreeing about what a browser can do.
 */

/** True when this browser can encode and decode Opus in-page. */
export function supportsOpus() {
  if (typeof window === "undefined") return false;
  return (
    typeof window.AudioEncoder !== "undefined" &&
    typeof window.AudioDecoder !== "undefined"
  );
}

/** The encoding to hand DirectVoiceButton: 'opus' where the browser can, else
 * 'pcm16'. Callers should not branch on anything else. */
export function preferredVoiceEncoding() {
  return supportsOpus() ? "opus" : "pcm16";
}
