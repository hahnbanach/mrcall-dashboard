import { businessCalendarAuthorizationUrl } from '@/utils/BusinessSkillConnection';

const KEY = 'mrcall.bookingConnectionIntent.v1';
const LIFETIME = 15 * 60 * 1000;

export function clearBookingIntent() { sessionStorage.removeItem(KEY); }

function readIntent() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY));
    if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() ||
        !['ownerUid', 'businessId', 'sessionId', 'setupToken', 'state'].every(key =>
          typeof value[key] === 'string' && value[key].length > 0)) throw new Error('invalid_intent');
    return value;
  } catch { clearBookingIntent(); return null; }
}

export async function bookingAuthorizationUrl(user, businessId, sessionId, setupToken, scopes) {
  clearBookingIntent();
  const url = await businessCalendarAuthorizationUrl(businessId, user.uid, scopes);
  sessionStorage.setItem(KEY, JSON.stringify({ ownerUid: user.uid, businessId, sessionId,
    setupToken, state: new URL(url).searchParams.get('state'), expiresAt: Date.now() + LIFETIME,
    connected: false }));
  return url;
}

// Called only after the existing callback has verified state/owner/scopes and stored the grant.
export function confirmBookingConnection(context, state) {
  const intent = readIntent();
  if (!intent || context?.target !== 'business' || context.provider !== 'google_calendar' ||
      context.grantName !== '' || context.ownerUid !== intent.ownerUid ||
      context.businessId !== intent.businessId || state !== intent.state) return;
  sessionStorage.setItem(KEY, JSON.stringify({ ...intent, connected: true }));
}

// Consumption precedes activation: a page reload cannot replay a completed OAuth return.
export function consumeBookingConnection(ownerUid, businessId, sessionId, setupToken) {
  const intent = readIntent();
  clearBookingIntent();
  if (!intent) return 'missing';
  return intent.connected && intent.ownerUid === ownerUid && intent.businessId === businessId &&
    intent.sessionId === sessionId && intent.setupToken === setupToken ? 'ready' : 'changed';
}
