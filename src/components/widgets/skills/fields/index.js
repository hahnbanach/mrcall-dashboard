import TextField from './TextField.vue'
import TextareaField from './TextareaField.vue'
import PasswordField from './PasswordField.vue'
import NumberField from './NumberField.vue'
import BooleanField from './BooleanField.vue'
import SelectField from './SelectField.vue'
import JsonField from './JsonField.vue'
import KeyValueField from './KeyValueField.vue'
import ListField from './ListField.vue'
import WeeklyHoursField from './WeeklyHoursField.vue'
import CalendarField from './CalendarField.vue'

/**
 * Which component draws which widget.
 *
 * ADDING A WIDGET IS A FILE AND A LINE HERE, and that is the whole point of the map: the card does
 * not know the list, so a skill that brings a new kind of field cannot make anybody edit the card,
 * the phases, or the nine widgets that were already working. On the server side the same addition
 * costs one value in the `x-widget` enum of `manifest-2.schema.json`, which is where a widget is
 * declared legal at all.
 *
 * TWO VOCABULARIES, ON PURPOSE. The key is the `widget` the manifest declares; the version 1 `type`
 * is accepted beside it because a row that carries no manifest is converted, and its type is all
 * there is. They differ in three places — `select`/`enum`, `list`/`tuples`, `text`/`string` — and
 * both are mapped so that neither the old rows nor the new ones need a special case elsewhere.
 */
export const fieldComponents = {
  // version 2, as the manifest declares them
  text: TextField,
  url: TextField,
  textarea: TextareaField,
  password: PasswordField,
  number: NumberField,
  boolean: BooleanField,
  select: SelectField,
  json: JsonField,
  keyvalue: KeyValueField,
  list: ListField,
  weekly_hours: WeeklyHoursField,
  calendar: CalendarField,

  // version 1, for a row that has no manifest of its own
  string: TextField,
  enum: SelectField,
  tuples: ListField
}

/** The component for a field, or nothing when no widget claims it.
  *
  * Nothing rather than a text box: a field drawn by the wrong widget looks like it works, and the
  * value it writes is wrong in a way nobody sees until a call goes badly. The card says instead
  * that this version of the dashboard does not know how to draw it.
  */
export function componentFor (field) {
  if (!field) return null
  return fieldComponents[field.widget] || fieldComponents[field.type] || null
}

/** Which widgets are drawn, for a test that wants to say "all of them". */
export const drawnWidgets = Object.keys(fieldComponents)
