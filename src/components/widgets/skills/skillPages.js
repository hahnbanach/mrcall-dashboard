/**
 * The skills that have a page of their own in the dashboard, and what the skill form says about it.
 *
 * WHY A REGISTRY. A field marked `x-audience: page` is drawn by no one but its skill's page (StarChat R8), and the
 * form shows a summary of those fields with a link there. The manifest says THAT a field belongs to a page, not
 * WHICH page: the page is the dashboard's, and so is where it lives. One skill has one today, the restaurant's.
 *
 * `edits` is the page's own list of what it writes (`Restaurant.PAGE_EDITS`): the summary names those, and not the
 * page fields no editor draws any more (the retired `specialDays` text, `variables`).
 */
import { PAGE_EDITS, SKILL_NAMES as RESTAURANT_SKILLS } from '@/utils/Restaurant'
import { valueOf } from '@/components/widgets/skills/manifestFields'
import RestaurantDataPanel from '@/components/widgets/restaurant/RestaurantDataPanel.vue'

const RESTAURANT = {
  section: '__RESTAURANT_BOOKING__',
  tab: 'rules',
  edits: PAGE_EDITS,
  /** Drawn in the card while the page is off: what the server keeps open then (the export and the erasure). */
  offPanel: RestaurantDataPanel,
  /**
   * A note under a form field whose limit is a page setting: the assistant's `daysAhead` is at most the book's
   * horizon, which the page edits. StarChat warns on a save above it and does not refuse it (brief, addendum
   * 2026-10-12 (2)); the form says so before.
   */
  notes (entry, skill) {
    const horizon = valueOf(entry, 'horizonDays')
    const field = ((skill && skill.configSchema && skill.configSchema.fields) || []).find(f => f.key === 'horizonDays')
    const n = horizon !== '' && horizon !== undefined && horizon !== null ? Number(horizon) : field ? Number(field.default) : null
    return { daysAhead: { key: 'widgets.agentSkills.page.daysAheadNote', args: { n: Number.isFinite(n) ? n : '?' } } }
  }
}

export const SKILL_PAGES = Object.fromEntries(RESTAURANT_SKILLS.map(name => [name, RESTAURANT]))

/** The page of a skill, or null. */
export function pageOf (skillName) {
  return SKILL_PAGES[skillName] || null
}

/** Where a skill's page is, from the address the form is on: the same business, that section, that tab. */
export function pageTarget (page, route) {
  return {
    path: route ? route.path : '/businessconfiguration',
    query: Object.assign({}, route ? route.query : {}, { section: page.section, tab: page.tab })
  }
}
