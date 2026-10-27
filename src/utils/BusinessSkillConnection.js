import { assertScopesAllowed, GoogleAuthFlow } from '@/utils/OAuth';
import axios from 'axios';

export async function loadBusinessSkillCatalogue(user, businessId) {
  const response = await axios.get(process.env.VUE_APP_STARCHAT_URL +
    '/mrcall/v1/mrcall0/apidomain/agent/skills', {
    headers: { auth: user.accessToken }, params: { businessId }
  });
  if (!Array.isArray(response.data)) throw new Error('invalid_skill_catalogue');
  return response.data;
}

// An explicit business-wide grant for new, unnamed calendar integrations only.
// Existing/named instances retain their separate saved-instance connection flow.
export function businessCalendarScopes(catalogue, changes, businessId) {
  const scopes = new Set();
  for (const change of changes || []) {
    if (!change || change.kind !== 'skill_instance' || change.business_id !== businessId ||
        change.action !== 'create' || change.instance_id ||
        (change.execution_state && change.execution_state !== 'pending')) continue;
    const skill = catalogue.find(row => row && (row.name || row.skill_name) === change.skill);
    const schema = skill?.configSchema;
    if (!Array.isArray(schema?.phases) || !schema.phases.includes(change.phase) || !Array.isArray(schema.fields)) continue;
    const params = change.params || {};
    if (typeof params !== 'object' || Array.isArray(params)) continue;
    const effective = Object.fromEntries(schema.fields.filter(field => field?.key &&
      Object.hasOwn(field, 'default')).map(field => [field.key, field.default]));
    Object.assign(effective, params);
    for (const field of schema.fields) {
      if (!field?.key || (field.widget || field.type) !== 'oauth' || field.provider !== 'google_calendar' ||
          field.storage !== 'oauth_provider' ||
          (field.default !== undefined && field.default !== '') ||
          (params[field.key] !== undefined && params[field.key] !== '')) continue;
      if (field.visibleWhen && (typeof field.visibleWhen !== 'object' || Array.isArray(field.visibleWhen) ||
          !Object.entries(field.visibleWhen).every(([key, value]) =>
            effective[key] !== undefined && String(effective[key]) === String(value)))) continue;
      try {
        assertScopesAllowed(field.scopes, 'business-skill-calendar').split(' ').forEach(scope => scopes.add(scope));
      } catch { continue; }
    }
  }
  const result = [...scopes].sort();
  return result.includes('https://www.googleapis.com/auth/calendar') ? result : [];
}

export async function businessCalendarAuthorizationUrl(businessId, ownerUid, scopes) {
  const scope = assertScopesAllowed(scopes, 'business-skill-calendar');
  const query = new URLSearchParams({ id: businessId, skillBusinessConnection: 'google_calendar' });
  const { state, codeChallenge } = await GoogleAuthFlow.begin({
    target: 'business', provider: 'google_calendar', businessId, grantName: '', ownerUid,
    returnUrl: '/businessconfiguration?' + query, scopes: scope.split(' ')
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for (const [key, value] of Object.entries({
    client_id: process.env.VUE_APP_GOOGLE_CLIENT_ID,
    redirect_uri: process.env.VUE_APP_GOOGLE_REDIRECT_URI,
    response_type: 'code', scope, access_type: 'offline', prompt: 'consent',
    state, code_challenge: codeChallenge, code_challenge_method: 'S256'
  })) url.searchParams.set(key, value);
  return url.toString();
}
