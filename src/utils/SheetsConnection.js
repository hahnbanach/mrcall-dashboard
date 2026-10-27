import { sheetsAuthorizationUrl } from '@/utils/BusinessSkillConnection';

const KEY = 'mrcall.sheetsConnectionIntent.v1';
const LIFETIME = 15 * 60 * 1000;
export function clearSheetsIntent() { sessionStorage.removeItem(KEY); }
function readIntent() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY));
    if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() ||
        !['ownerUid', 'businessId', 'sessionId', 'fingerprint', 'state'].every(key =>
          typeof value[key] === 'string' && value[key]) || typeof value.grantName !== 'string' ||
        typeof value.instanceId !== 'string') throw new Error('invalid_intent');
    return value;
  } catch { clearSheetsIntent(); return null; }
}
export async function beginSheetsConnection(ownerUid, businessId, sessionId, target) {
  clearSheetsIntent();
  if (!ownerUid || !businessId || !sessionId || !target?.fingerprint) throw new Error('missing_sheets_context');
  const url = await sheetsAuthorizationUrl(businessId, ownerUid, target);
  sessionStorage.setItem(KEY, JSON.stringify({ ownerUid, businessId, sessionId,
    fingerprint: target.fingerprint, instanceId: target.instanceId, grantName: target.grantName,
    state: new URL(url).searchParams.get('state'), expiresAt: Date.now() + LIFETIME, connected: false }));
  return url;
}
// Only the verified callback calls this, after the authenticated provider connect.
export function confirmSheetsConnection(context, state) {
  const intent = readIntent();
  if (!intent || context?.provider !== 'google_sheets' || context.ownerUid !== intent.ownerUid ||
      context.businessId !== intent.businessId || state !== intent.state ||
      context.grantName !== intent.grantName || (context.instanceId || '') !== intent.instanceId ||
      (intent.instanceId ? context.phase !== 'final' : context.target !== 'business')) return;
  sessionStorage.setItem(KEY, JSON.stringify({ ...intent, connected: true }));
}
// Called only once history and the chat are ready; URL markers confer no authority.
export function consumeSheetsConnection(ownerUid, businessId, sessionId, targets) {
  const intent = readIntent();
  if (!intent) return false;
  const matches = intent.ownerUid === ownerUid && intent.businessId === businessId &&
    intent.sessionId === sessionId && targets.some(target => target.fingerprint === intent.fingerprint);
  if (!matches) { clearSheetsIntent(); return false; }
  if (intent.connected !== true) return false;
  clearSheetsIntent();
  return true;
}
