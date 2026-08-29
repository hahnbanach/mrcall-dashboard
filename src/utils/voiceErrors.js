/** Classify a voice-call start error as a microphone failure the user can fix.
 *
 * The dashboard splits mic failures from every other start failure: a mic error
 * gets a real modal popup with the re-grant instructions (click the padlock…),
 * everything else stays a raw-detail toast because that is what support needs to
 * see. The split used to hinge on `err.name` alone — NotAllowedError /
 * SecurityError → micDenied, NotFoundError / OverconstrainedError → micNotFound,
 * else raw toast. That missed real "Permission dismissed" failures where the
 * browser/SDK permutation surfaced a name the switch did not list: the screenshot
 * that prompted this showed the generic toast firing for a dismissed prompt. A
 * single non-contractual property is not a reliable classifier.
 *
 * So this matches on BOTH `err.name` (the four DOMException names plus the legacy
 * PermissionDeniedError / PermissionDismissedError / DevicesNotFoundError) AND on
 * the message text:
 *   /permission (denied|dismissed)|not allowed|denied by system/i → micDenied
 *   /no (microphone|audio)|device.*not found|not found/i          → micNotFound
 *
 * Conservative by design: when in doubt it returns null, so support still gets
 * the raw toast with the original detail. Callers must not read null as "not a
 * mic error", only as "not confidently a mic error".
 *
 * Utils may import nothing from components or views (see the dependency rules in
 * CLAUDE.md); this file is pure and throws on nothing. */

const MIC_DENIED_NAMES = new Set([
  "NotAllowedError",
  "SecurityError",
  "PermissionDeniedError",
  "PermissionDismissedError",
]);

const MIC_NOT_FOUND_NAMES = new Set([
  "NotFoundError",
  "OverconstrainedError",
  "DevicesNotFoundError",
]);

const MIC_DENIED_RE = /permission (denied|dismissed)|not allowed|denied by system/i;
const MIC_NOT_FOUND_RE = /no (microphone|audio)|device.*not found|not found/i;

/** 'micDenied' | 'micNotFound' | null — never throws. */
export function classifyVoiceError(err) {
  let name = null;
  let message = null;

  if (err != null) {
    if (typeof err === "object") {
      if (typeof err.name === "string") name = err.name;
      if (typeof err.message === "string") {
        message = err.message;
      } else if (typeof err.toString === "function") {
        try {
          const s = err.toString();
          if (typeof s === "string") message = s;
        } catch {
          /* ignore */
        }
      }
    } else if (typeof err === "string") {
      message = err;
    } else {
      try {
        message = String(err);
      } catch {
        /* ignore */
      }
    }
  }

  if (name && MIC_DENIED_NAMES.has(name)) return "micDenied";
  if (name && MIC_NOT_FOUND_NAMES.has(name)) return "micNotFound";

  if (message) {
    if (MIC_DENIED_RE.test(message)) return "micDenied";
    if (MIC_NOT_FOUND_RE.test(message)) return "micNotFound";
  }

  return null;
}
