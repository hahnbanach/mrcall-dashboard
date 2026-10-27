const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function localizedSkillLabel(value, locale) {
  if (typeof value === 'string') return value;
  const label = value?.[locale] || value?.[locale.split('-')[0]] || value?.['*'] || value?.['en-US'] || value?.en;
  return typeof label === 'string' ? label : typeof label?.label === 'string' ? label.label : '';
}

export function changedSkillFields(change) {
  return [...new Set([...Object.keys(change.preview?.before || {}), ...Object.keys(change.preview?.after || {})])]
    .filter(key => JSON.stringify(change.preview?.before?.[key]) !== JSON.stringify(change.preview?.after?.[key]));
}

export function exactSkillValue(value) {
  return value === undefined || value === null ? '—' :
    typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

function decoded(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

export function skillBoolean(value) {
  const parsed = decoded(value);
  return typeof parsed === 'boolean' ? parsed : null;
}

function weeklyHours(value, t) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  const time = '(?:[01]\\d|2[0-3]):[0-5]\\d';
  const range = new RegExp(`^${time}-${time}$`);
  if (!keys.length || !keys.every(day => days.includes(day) && Array.isArray(value[day]) &&
    value[day].every(period => typeof period === 'string' && range.test(period)))) return null;
  return days.filter(day => Object.hasOwn(value, day)).map(day =>
    `${t(`views.configureAI.summary.${day}`)}: ${value[day].length ? value[day].join(', ').replaceAll('-', '–') : t('views.configureAI.summary.closed')}`
  ).join('\n');
}

export function readableSkillValue(value, t) {
  if (value === undefined || value === null) return null;
  const parsed = decoded(value);
  if (typeof parsed === 'boolean') return t(`views.configureAI.summary.${parsed ? 'yes' : 'no'}`);
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return String(parsed);
  const hours = weeklyHours(parsed, t);
  if (hours !== null) return hours;
  if (typeof parsed !== 'string' || !parsed.trim()) return null;
  if (/^[a-z][a-z0-9_]*$/.test(parsed)) return null;
  return parsed;
}

export function skillSummary(change, locale, t) {
  const fields = changedSkillFields(change);
  const rows = [];
  for (const key of fields) {
    if (key === 'enabled') continue;
    if (/^(trigger|prompt.*|descriptionTemplate|variables|title|exportAs|slotsFrom)$/i.test(key)) continue;
    const label = localizedSkillLabel(change.preview?.field_labels?.[key], locale);
    const before = readableSkillValue(change.preview?.before?.[key], t);
    const after = readableSkillValue(change.preview?.after?.[key], t);
    const relevant = change.action === 'remove' ? before : after;
    if (label && relevant !== null && (change.action !== 'replace' || change.preview?.before?.[key] == null || before !== null)) {
      rows.push({ key, label, before, after });
    }
  }
  const enabled = skillBoolean(change.preview?.after?.enabled);
  const activation = change.action === 'remove' ? 'removal' : enabled === true ? 'active' : enabled === false ? 'inactive' : 'unspecified';
  const technicalCount = fields.filter(key => key !== 'enabled' && !rows.some(row => row.key === key)).length;
  return { rows, activation, technicalCount };
}
