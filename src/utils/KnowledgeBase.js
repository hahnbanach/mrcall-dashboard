/**
 * "Aggiungi la risposta" (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, the report detail): a question a
 * report found unanswered opens the business's knowledge base with one question/answer pair added, the question
 * filled and the answer left to write, through `/businessconfiguration?id=<business>&section=__KNOWLEDGE_BASE__&draftQuestion=<text>`.
 *
 * The pairs are the `tuples` variable of the `__KNOWLEDGE_BASE__` collection (StarChat's
 * `KNOWLEDGE_BASE_ANSWER_INSTRUCTIONS`, `[[question, answer], ...]`); it is found by its collection and type, not by
 * its name, so a template that renames it keeps working. Nothing is saved here: the pair is added to the page's copy
 * of the business, and the person saves it with the page's own button, as every other change.
 */
export const KNOWLEDGE_BASE_SECTION = "__KNOWLEDGE_BASE__";

const MAX_QUESTION = 500;

// The question as it may enter the form: trimmed, one line, bounded.
export function cleanQuestion(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION);
}

// The tuples variable that holds the pairs, among the page's collections; null when the template has none.
export function pairsVariable(variablesAnnotations) {
  if (!Array.isArray(variablesAnnotations)) return null;
  const page = variablesAnnotations.find((p) => p && p.collection && p.collection.id === KNOWLEDGE_BASE_SECTION);
  if (!page || !Array.isArray(page.variables)) return null;
  // StarChat answers a page's variables grouped (`nested=true`): a list of groups, each a list of variables
  return page.variables.flat().find((v) => v && v.type === "tuples") || null;
}

/**
 * Adds `[question, ""]` at the top of the business's pairs, once: a question already there (the link opened twice, a
 * reload) is not added again. Answers what happened: `added`, `present`, or `none` (no pairs variable, or no question).
 */
export function addDraftQuestion(business, variablesAnnotations, rawQuestion) {
  const question = cleanQuestion(rawQuestion);
  const variable = pairsVariable(variablesAnnotations);
  if (!question || !variable || !business || !business.variables) return { outcome: "none", variable: null };
  let pairs = business.variables[variable.name];
  // pairs that cannot be read are left alone: writing over them would lose them on save
  if (typeof pairs === "string") {
    if (pairs.trim() === "") pairs = [];
    else {
      try { pairs = JSON.parse(pairs); } catch { return { outcome: "none", variable: null }; }
    }
  }
  if (pairs === undefined || pairs === null) pairs = [];
  if (!Array.isArray(pairs)) return { outcome: "none", variable: null };
  const folded = question.toLowerCase();
  if (pairs.some((p) => Array.isArray(p) && typeof p[0] === "string" && p[0].trim().toLowerCase() === folded)) {
    return { outcome: "present", variable: variable.name };
  }
  business.variables[variable.name] = [[question, ""], ...pairs];
  return { outcome: "added", variable: variable.name };
}
