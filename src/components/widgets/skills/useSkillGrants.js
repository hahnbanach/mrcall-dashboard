import { ref } from 'vue'
import { CALENDAR_FIELD_KEY } from '@/components/widgets/skills/manifestFields'

/**
 * The authorisations a business holds, and what each of them can offer.
 *
 * MOVED OUT OF THE CARD, unchanged. It is the machinery every skill with an OAuth field shares —
 * which grant an instance acts with, whether it is connected, which calendars that grant can see,
 * who else is using it — and it was two hundred lines in the middle of a component whose subject is
 * a configuration form. A skill added tomorrow needs none of it changed; a second provider needs it
 * changed in one place.
 *
 * WHAT IT IS GIVEN, and why each: the store for the user's token, the business the card is
 * configuring, a way to read the fields of an entry and to list every entry — because an
 * authorisation is shared between instances and the question "who else uses this" cannot be
 * answered from one of them — a way to write a field, the way an instance is NAMED, because the
 * list of authorisations names them and two label rules for one thing is how they come to
 * disagree, and the translator, because what it returns includes sentences a person reads.
 */
export function useSkillGrants({ store, businessId, fieldsOf, entriesOf, setFieldValue,
                                 instanceLabel, t }) {
  // The authorisations this user holds, as the backend lists them. Kept as the list rather than a
  // map keyed by provider: one business can hold several grants for one provider, one per skill
  // instance, so a map keyed that way would say "connected" for an instance that is not.
  const oauthGrants = ref([])
  const calendarsByGrant = ref({})
  const calendarsLoading = ref({})


  async function checkOAuthStatus() {
    const user = store.state.user;
    if (!user) return;
    try {
      const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/oauth/providers";
      const response = await (await import('axios')).default.get(url, { headers });
      oauthGrants.value = response.data || [];
    } catch (e) {
      console.debug("OAuth status check failed:", e);
    }
  }


  // Which authorisation an instance acts with. The instance id the platform already assigns,
  // `{outputPrefix}_{N}`, is that name: assigned once, stored with the entry, never shown and never
  // typed. An entry that has been pointed at another instance's authorisation carries that name in
  // the field instead, which is how one authorisation is reused by two instances.
  function grantNameFor(entry, field) {
    const stored = entry && entry.params ? entry.params[field.key] : '';
    return (stored && String(stored).trim()) || (entry && entry.instanceId) || '';
  }


  // Empty business or empty name mean ANY on the backend, which is the authorisation given before
  // these were scoped. An instance is covered by its own, or by one given for the whole business.
  function grantFor(field, entry) {
    const wanted = grantNameFor(entry, field);
    const mine = oauthGrants.value.filter(g =>
      g.provider === field.provider && (g.businessId || '') === (businessId() || ''));
    return mine.find(g => (g.grantName || '') === wanted)
      || mine.find(g => (g.grantName || '') === '')
      || null;
  }


  function isOAuthConnected(field, entry) {
    return !!grantFor(field, entry);
  }


  // What this instance could act with instead of asking for a new authorisation: the ones this
  // business already holds for the same provider, minus the one it is using. Shown by account, since
  // the name is an internal identifier and means nothing to a reader.
  // Every authorisation this business holds for this provider, the one in use included.
  //
  // It used to list only the OTHERS, as a "reuse one" control beside the connect button, and that is
  // why choosing one looked like it did nothing: the moment the choice was made the chosen grant
  // became the current one, dropped out of its own list, and the whole control disappeared. Nothing
  // confirmed the choice and nothing showed what was now in use. One dropdown, with the current
  // value selected, says both.
  function grantOptions(field) {
    return oauthGrants.value.filter(g =>
      g.provider === field.provider
      && (g.businessId || '') === (businessId() || '')
      && (g.grantName || ''));
  }


  /** What to call an authorisation on screen.
   *
   * The account's email, when the grant carries one. Grants given before the connect started sending
   * `providerAccountId` do not, and on this estate that is every one of them, which is why this list
   * read "Google Calendar" three times over and told a reader nothing. So, in order: the account,
   * then the calendar the instance that gave it books on, then the instance's own name. The last is
   * an internal identifier and a poor label, but it is a DISTINGUISHING one, and between a bad name
   * and three identical good ones the bad name is the one you can act on.
   */
  /** What to call an authorisation on screen, in a list where several may look alike.
   *
   * It names the CARD the authorisation was given for, always with that card's number, and adds the
   * account when the grant carries one. The number is not optional here as it is on a card header: a
   * header sits above the thing it names, while this list is the only place two authorisations of
   * two instances of one skill can be told apart, and without it they read identically.
   */
  function grantAccountLabel(grant) {
    if (!grant) return '';
    const owner = entriesOf().find(e => e.instanceId === grant.grantName);
    const parts = [];
    if (owner) {
      // The same function the card header uses, so that what this list names can be found on the
      // screen by reading. Two label rules for one thing is how they came to disagree.
      parts.push(instanceLabel(owner));
      const calendar = calendarNameOf(owner);
      if (calendar) parts.push(calendar);
    } else if (grant.grantName) {
      // No card OWNS it. That is not the same as nobody using it: the instance that asked for it may
      // have been deleted while another card still acts with it, and that grant is inherited rather
      // than orphaned. Named by whoever uses it, and called orphaned only when nobody does.
      const users = instancesUsing(grant.grantName);
      parts.push(users.length > 0
        ? instanceLabel(users[0])
        : t('widgets.agentSkills.oauthOrphanGrant'));
    }
    if (grant.providerAccountId) parts.push(grant.providerAccountId);
    return parts.length ? parts.join(' — ') : grant.grantName;
  }


  async function loadCalendars(field, entry) {
    if (field.provider !== 'google_calendar') return;
    const grant = grantFor(field, entry);
    if (!grant || !grant.grantName) return;
    if (calendarsByGrant.value[grant.grantName] || calendarsLoading.value[grant.grantName]) return;
    const user = store.state.user;
    if (!user) return;
    calendarsLoading.value = { ...calendarsLoading.value, [grant.grantName]: true };
    try {
      const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
      const params = new URLSearchParams();
      if (grant.businessId) params.set('businessId', grant.businessId);
      if (grant.grantName) params.set('grantName', grant.grantName);
      const url = process.env.VUE_APP_STARCHAT_URL
        + `/mrcall/v1/mrcall0/oauth/providers/${field.provider}/calendars?${params.toString()}`;
      const response = await (await import('axios')).default.get(url, { headers });
      calendarsByGrant.value = { ...calendarsByGrant.value, [grant.grantName]: response.data || [] };
    } catch (error) {
      console.debug('Could not list the calendars of this authorisation:', error);
      calendarsByGrant.value = { ...calendarsByGrant.value, [grant.grantName]: [] };
    } finally {
      const pending = { ...calendarsLoading.value };
      delete pending[grant.grantName];
      calendarsLoading.value = pending;
    }
  }


  /** The calendars offered for this instance, with the account's own first. */
  function calendarOptions(entry) {
    const oauthField = fieldsOf(entry).find(f => f.type === 'oauth');
    const grant = oauthField ? grantFor(oauthField, entry) : null;
    const list = (grant && calendarsByGrant.value[grant.grantName]) || [];
    return list.map(c => ({
      value: c.id,
      primary: !!c.primary,
      label: c.primary ? `${c.summary} (${t('widgets.agentSkills.calendarPrimary')})` : c.summary
    }));
  }


  /** The calendar an instance books on, by name when the name is known. */
  function calendarNameOf(entry) {
    const current = (entry.params || {})[CALENDAR_FIELD_KEY];
    const known = calendarOptions(entry).find(o => o.value === current);
    if (known) return known.label;
    if (current) return current;
    const primary = calendarOptions(entry).find(o => o.primary);
    return primary ? primary.label : '';
  }


  /** What to say where the calendar goes when there is nothing to choose from yet, which is never a
   *  blank: either this instance has no authorisation, or the list has not arrived. */
  function calendarSummary(entry) {
    const named = calendarNameOf(entry);
    if (named) return named;
    const oauthField = fieldsOf(entry).find(f => f.type === 'oauth');
    if (!oauthField || !isOAuthConnected(oauthField, entry)) {
      return t('widgets.agentSkills.calendarNotChosen');
    }
    return t('widgets.agentSkills.calendarUnavailable');
  }


  /** Whose authorisation this is.
   *
   * An authorisation is named after the instance that asked for it, so an instance owns the one
   * whose name is its own id and borrows any other. The distinction is not cosmetic: revoking is an
   * act on the Google account and takes the authorisation away from every instance using it, while
   * an instance that merely borrowed one has nothing to revoke and everything to lose by trying.
   */
  function ownsGrant(entry, grant) {
    return !!grant && !!entry.instanceId && grant.grantName === entry.instanceId;
  }


  /** Which instances, anywhere in the configuration, act with this authorisation. */
  function instancesUsing(grantName) {
    if (!grantName) return [];
    return entriesOf().filter(e => {
      const oauthField = fieldsOf(e).find(f => f.type === 'oauth');
      return oauthField && grantNameFor(e, oauthField) === grantName;
    });
  }


  function useExistingGrant(phase, entryIdx, field, grantName) {
    if (!grantName) return;
    setFieldValue(phase, entryIdx, field.key, grantName);
  }


  /** Take an authorisation back from Google. The one act here that cannot be undone from this page:
   *  the tokens are gone and the only way back is the consent screen. */
  async function revokeGrant(field, grant) {
    const user = store.state.user;
    if (!user || !grant) return;
    const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
    // Named exactly as it was looked up. Revoking on the provider alone would take every business's
    // authorisation for it, including ones this screen is not showing.
    const params = new URLSearchParams();
    if (grant.businessId) params.set('businessId', grant.businessId);
    if (grant.grantName) params.set('grantName', grant.grantName);
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = process.env.VUE_APP_STARCHAT_URL
      + `/mrcall/v1/mrcall0/oauth/providers/${field.provider}${query}`;
    await (await import('axios')).default.delete(url, { headers });
    oauthGrants.value = oauthGrants.value.filter(g => g !== grant);
  }

  return {
    oauthGrants,
    calendarsByGrant,
    checkOAuthStatus,
    grantNameFor,
    grantFor,
    isOAuthConnected,
    grantOptions,
    grantAccountLabel,
    loadCalendars,
    calendarOptions,
    calendarNameOf,
    calendarSummary,
    ownsGrant,
    instancesUsing,
    useExistingGrant,
    revokeGrant
  }
}
