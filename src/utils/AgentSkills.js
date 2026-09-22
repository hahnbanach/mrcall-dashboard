import axios from "axios";

/**
 * Agent Skills Utility — Phase-first layout with granular multiplicity and OAuth support.
 *
 * === configSchema Specification ===
 * Defined in agent_skills.json actionInput[0].configSchema:
 *
 * {
 *   phases: string[]            - Available phases: "prefetch", "during", "final"
 *   instances: {
 *     max: number|null          - Max total instances across ALL phases (null = unlimited)
 *     maxPerPhase: number|null  - Max instances per single phase (null = unlimited)
 *   }
 *   outputPrefix: string        - Base prefix for output variables (auto-derived if omitted)
 *   fields: Array<{
 *     key: string               - Variable key name
 *     type: "string"|"url"|"password"|"number"|"boolean"|"enum"|"keyvalue"|"textarea"|"json"|"oauth"
 *     required: boolean
 *     default: any
 *     min: number               - For type "number"
 *     max: number               - For type "number"
 *     options: Array<{label,value}> - For type "enum": dropdown options
 *     provider: string          - For type "oauth": provider ID (e.g., "google_sheets")
 *     scopes: string[]          - For type "oauth": required OAuth scopes
 *     storage: "business_variable"|"skill_param"|"oauth_provider"
 *     labels: {
 *       en: { label: string, hint: string },
 *       it: { label: string, hint: string }
 *     }
 *   }>
 * }
 *
 * === Instances Examples ===
 *   { max: 1 }                  - Single instance globally (one phase only)
 *   { maxPerPhase: 1 }          - One instance per phase (default if omitted)
 *   { maxPerPhase: 3 }          - Up to 3 instances per phase
 *   { maxPerPhase: null }       - Unlimited instances per phase
 *   { max: 5, maxPerPhase: 2 }  - Up to 5 total, max 2 per phase
 *
 * === Config Data Model ===
 * Stored in AGENT_SKILL_INTEGRATIONS business variable:
 *
 * {
 *   prefetch: SkillEntry[],
 *   during:   SkillEntry[],
 *   final:    SkillEntry[]
 * }
 *
 * SkillEntry:
 * { skill: "skill_general_rest_api", instanceId: "rest_api_1", params: { ... } }
 *
 * instanceId is auto-generated for multi-instance skills: {outputPrefix}_{N}
 */
export default {

    getAvailableSkills: async function(user, businessId) {
        const headers = {
            "Content-type": "application/json; charset=UTF-8",
            "auth": user.accessToken
        };
        const url = process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/agent/skills/available" +
            (businessId ? "?businessId=" + encodeURIComponent(businessId) : "");
        try {
            const response = await axios.get(url, { headers });
            return response.data || [];
        } catch (e) {
            console.error("Failed to fetch available skills:", e);
            return [];
        }
    },

    /**
     * The skill configuration goes down its own door, and only that door will take it.
     *
     * A skill configuration lives in the business variables, but the ordinary business save DROPS
     * the variables whose declared type begins `apidomain_`: the server keeps them only for a write
     * that names the type as its own, which no REST payload can do and this endpoint does. So a
     * change made in the skills card is persisted here or nowhere, and pressing Save on the page no
     * longer decides it.
     *
     * What comes back is a verdict and not only a status: the same diagnostics the card can put
     * beside the fields they name — the manifest's, and the skill's own.
     */
    saveConfiguration: async function(user, businessId, variables) {
        const headers = {
            "Content-type": "application/json; charset=UTF-8",
            "auth": user.accessToken
        };
        const url = process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/apidomain/agent/skills/configuration/" + encodeURIComponent(businessId);
        try {
            const response = await axios.put(url, variables, { headers });
            return { saved: true, diagnostics: (response.data && response.data.diagnostics) || [] };
        } catch (e) {
            // 422 is the one answer that is not a failure of the call: the configuration was read,
            // judged and refused, and what it says is what a person has to act on.
            const refused = e.response && e.response.status === 422;
            return {
                saved: false,
                diagnostics: refused ? (e.response.data.diagnostics || []) : [],
                error: refused ? null : e.message
            };
        }
    },

    /**
     * Persist whatever skill configuration a business is carrying, and nothing else of it.
     *
     * The caller hands over the variables it has and learns what became of them. Which of those
     * variables belong to this domain is decided HERE, and the server decides it again when it
     * writes: a page that had to know the three names would have to be edited the day a fourth
     * appears, and it is not the page's business to know there are three.
     *
     * Nothing to persist is not a failure: a business with no skill card configured has no
     * configuration, and a save that reported an error for that would be wrong twice.
     */
    persistConfiguration: async function(user, businessId, variables) {
        if (!businessId || !variables) return null;
        const mine = {};
        Object.values(this.phaseVariables).forEach(name => {
            const value = variables[name];
            if (value !== undefined && value !== null) {
                mine[name] = typeof value === "string" ? value : JSON.stringify(value);
            }
        });
        if (Object.keys(mine).length === 0) return null;
        return this.saveConfiguration(user, businessId, mine);
    },

    /** The same verdict without writing, for a card that wants to say it before Save is pressed. */
    validateConfiguration: async function(user, businessId, variables) {
        const headers = {
            "Content-type": "application/json; charset=UTF-8",
            "auth": user.accessToken
        };
        const url = process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/apidomain/agent/skills/configuration/" +
            encodeURIComponent(businessId) + "/validate";
        try {
            const response = await axios.post(url, variables, { headers });
            return response.data || { valid: true, diagnostics: [] };
        } catch (e) {
            console.error("Failed to validate the skill configuration:", e);
            return { valid: true, diagnostics: [] };
        }
    },

    /** One sentence per diagnostic, in the order a person reads them. */
    describeDiagnostics: function(diagnostics) {
        return (diagnostics || [])
            .filter(d => d.severity === "error")
            .map(d => `${d.path}: ${d.detail}`)
            .join("; ");
    },

    parseConfig: function(configValue) {
        if (!configValue || configValue === "{}" || configValue === "") {
            return { prefetch: [], during: [], final: [] };
        }
        try {
            const parsed = typeof configValue === "string" ? JSON.parse(configValue) : configValue;
            return {
                prefetch: parsed.prefetch || [],
                during: parsed.during || [],
                final: parsed.final || []
            };
        } catch (e) {
            console.error("Failed to parse AGENT_SKILL_INTEGRATIONS:", e);
            return { prefetch: [], during: [], final: [] };
        }
    },

    serializeConfig: function(config) {
        return JSON.stringify(config);
    },

    /**
     * Where each phase keeps its configuration. The same three names the runtime reads in
     * `services/agent/skills/SkillPhaseConfiguration.scala`; the phase this file calls `during` is
     * RUNNINGLOOP there, and they are the same phase.
     */
    phaseVariables: {
        prefetch: "SKILL_PREFETCH_CONFIGURATION",
        during: "SKILL_RUNNINGLOOP_CONFIGURATION",
        final: "SKILL_FINAL_CONFIGURATION"
    },

    /** The single variable the three replace, still written and still read while it exists. */
    legacyVariable: "AGENT_SKILL_INTEGRATIONS",

    isPhaseVariable: function(name) {
        return Object.keys(this.phaseVariables).some(phase => this.phaseVariables[phase] === name);
    },

    /**
     * One phase's entries, whichever spelling the value carries: the array the dashboard writes, or
     * an object keyed by instance, which is how a configuration written by hand reads. An entry
     * keyed that way takes its key as its instanceId, exactly as the runtime does.
     */
    asEntries: function(value) {
        if (value === undefined || value === null || value === "") return [];
        let parsed = value;
        if (typeof value === "string") {
            try { parsed = JSON.parse(value); } catch { return []; }
        }
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "object") {
            return Object.keys(parsed).map(instanceId =>
                parsed[instanceId] && parsed[instanceId].instanceId
                    ? parsed[instanceId]
                    : { ...parsed[instanceId], instanceId });
        }
        return [];
    },

    /**
     * The three phases, read the way the runtime reads them: the phase's own variable when it holds
     * something, the single blob when it does not. A phase variable holding `[]` is the catalogue
     * default, written into every business the first time anything is saved there, so it is not an
     * answer and does not hide the blob.
     */
    readPhaseConfig: function(variables) {
        const source = variables || {};
        const legacy = this.parseConfig(source[this.legacyVariable]);
        const config = {};
        Object.keys(this.phaseVariables).forEach(phase => {
            const own = this.asEntries(source[this.phaseVariables[phase]]);
            config[phase] = own.length > 0 ? own : this.asEntries(legacy[phase]);
        });
        return config;
    },

    /**
     * Write it into the three variables AND into the blob, the same content in both, for as long as
     * both exist. The runtime prefers a phase variable that holds something and reads the blob when
     * it does not, so a save that filled only one of the two would let them answer differently: a
     * phase emptied here would come back from the blob, and a business that had opted in with no
     * skills at all would change engine. When the blob is dropped from the catalogue, the line that
     * writes it goes with it and nothing else here changes.
     */
    writePhaseConfig: function(variables, configValue) {
        const config = this.parseConfig(configValue);
        let total = 0;
        Object.keys(this.phaseVariables).forEach(phase => {
            const entries = config[phase] || [];
            variables[this.phaseVariables[phase]] = entries;
            total += entries.length;
        });
        // A business with no skills says so, rather than saying "I use skills, and have none".
        // The decision table reads this variable to choose between the skill engine and the one
        // before it, and this widget emits its value on every load, so writing the empty triple
        // here would move a business onto the skill engine the first time somebody opened its
        // configuration page and saved it, with nothing to run. `{}` is what the catalogue means
        // by empty, and it is what that business held before anyone opened the page.
        variables[this.legacyVariable] = total > 0 ? config : {};
        return variables;
    },

    // --- Skill metadata accessors ---

    getSkillPhases: function(skill) {
        return (skill.configSchema && skill.configSchema.phases) || ["during"];
    },

    getSkillFields: function(skill) {
        return (skill.configSchema && skill.configSchema.fields) || [];
    },

    getOutputPrefix: function(skill) {
        if (skill.configSchema && skill.configSchema.outputPrefix) {
            return skill.configSchema.outputPrefix;
        }
        return (skill.skill_name || skill.name || "").replace(/^(skill[._]|test[._])*/g, "").replace(/\./g, "_");
    },

    /**
     * Get the instances configuration with backward compatibility.
     * Returns { max: number|null, maxPerPhase: number|null }
     */
    getInstancesConfig: function(skill) {
        const cs = skill.configSchema || {};
        if (cs.instances) {
            return {
                max: cs.instances.max !== undefined ? cs.instances.max : null,
                maxPerPhase: cs.instances.maxPerPhase !== undefined ? cs.instances.maxPerPhase : 1
            };
        }
        // Backward compat: multiInstance: true → unlimited
        if (cs.multiInstance === true) return { max: null, maxPerPhase: null };
        // Default: one per phase
        return { max: null, maxPerPhase: 1 };
    },

    /**
     * Check if a skill allows multiple instances (per phase or globally).
     */
    isMultiInstance: function(skill) {
        const ic = this.getInstancesConfig(skill);
        return ic.maxPerPhase === null || ic.maxPerPhase > 1;
    },

    /**
     * Count all instances of a skill across all phases.
     */
    countAllInstances: function(config, skillName) {
        let count = 0;
        for (const phase of ["prefetch", "during", "final"]) {
            count += (config[phase] || []).filter(e => e.skill === skillName).length;
        }
        return count;
    },

    /**
     * Count instances of a skill in a specific phase.
     */
    countPhaseInstances: function(config, skillName, phase) {
        return (config[phase] || []).filter(e => e.skill === skillName).length;
    },

    /**
     * Check if adding another instance of this skill to this phase is allowed.
     */
    canAddToPhase: function(config, skill, phase) {
        const ic = this.getInstancesConfig(skill);
        const phases = this.getSkillPhases(skill);
        if (!phases.includes(phase)) return false;

        // Check maxPerPhase
        if (ic.maxPerPhase !== null) {
            const phaseCount = this.countPhaseInstances(config, skill.name, phase);
            if (phaseCount >= ic.maxPerPhase) return false;
        }

        // Check max (global)
        if (ic.max !== null) {
            const totalCount = this.countAllInstances(config, skill.name);
            if (totalCount >= ic.max) return false;
        }

        return true;
    },

    // --- Phase-first operations ---

    /**
     * Get skills that can be added to a given phase.
     */
    getAddableSkills: function(availableSkills, config, phase) {
        return availableSkills.filter(skill => this.canAddToPhase(config, skill, phase));
    },

    /**
     * Add a skill instance to a phase.
     */
    addSkillToPhase: function(config, skillObj, phase, reservedIds) {
        const newConfig = {
            prefetch: [...(config.prefetch || [])],
            during: [...(config.during || [])],
            final: [...(config.final || [])]
        };
        const entry = { skill: skillObj.name, params: {} };

        // Populate defaults from configSchema.fields (skip oauth fields)
        const fields = this.getSkillFields(skillObj);
        for (const field of fields) {
            if (field.type === "oauth") continue;
            if (field.default !== undefined && field.default !== null) {
                entry.params[field.key] = String(field.default);
            }
        }

        if (this.isMultiInstance(skillObj)) {
            entry.instanceId = this._nextInstanceId(config, skillObj, reservedIds);
        }

        // FIRST, not last. The control that adds one sits at the top of the phase, so a new entry
        // appended to the end appears below everything already configured, out of sight, and the
        // person who just created it has to go looking for it.
        //
        // The order is not only presentation: in `prefetch` it is the order the fragments are
        // injected in, so the newest now goes in first. Nobody has ever been able to reorder these
        // from the screen, so the order was already an accident of the sequence somebody added
        // them in; this makes a different accident, a visible one.
        newConfig[phase].unshift(entry);
        return newConfig;
    },

    /**
     * Copies an entry beside itself, switched off.
     *
     * The copy is the same configuration with a new identity: a fresh instanceId, because that id
     * is what tells two instances apart everywhere else, and `enabled` forced to "false", because
     * a copy made to be edited is not a copy meant to answer calls in the meantime.
     *
     * The OAuth field is copied AS IT IS, which is deliberate. Its value names the authorisation
     * the instance acts with, so a copy that keeps it acts with the same Google account as the
     * original and asks nobody to authorise anything again. Blanking it would not have been
     * neutral either: an empty value falls back to whatever the business authorised, which is a
     * different account chosen by accident rather than on purpose.
     */
    duplicateInPhase: function(config, skillObj, phase, index, reservedIds) {
        const newConfig = {
            prefetch: [...(config.prefetch || [])],
            during: [...(config.during || [])],
            final: [...(config.final || [])]
        };
        const original = newConfig[phase][index];
        if (!original) return config;

        const copy = {
            ...original,
            params: { ...(original.params || {}), enabled: "false" }
        };
        if (skillObj && this.isMultiInstance(skillObj)) {
            copy.instanceId = this._nextInstanceId(newConfig, skillObj, reservedIds);
        } else {
            delete copy.instanceId;
        }
        newConfig[phase].splice(index + 1, 0, copy);
        return newConfig;
    },

    removeFromPhase: function(config, phase, index) {
        const newConfig = {
            prefetch: [...(config.prefetch || [])],
            during: [...(config.during || [])],
            final: [...(config.final || [])]
        };
        newConfig[phase].splice(index, 1);
        return newConfig;
    },

    updateEntryParam: function(config, phase, index, key, value) {
        const newConfig = {
            prefetch: [...(config.prefetch || [])],
            during: [...(config.during || [])],
            final: [...(config.final || [])]
        };
        const entry = { ...newConfig[phase][index] };
        entry.params = { ...(entry.params || {}) };
        if (value === "" || value === undefined || value === null) {
            delete entry.params[key];
        } else {
            entry.params[key] = value;
        }
        newConfig[phase][index] = entry;
        return newConfig;
    },

    findSkill: function(availableSkills, skillName) {
        return availableSkills.find(s => s.name === skillName) || null;
    },

    skillDisplayName: function(skillName) {
        return (skillName || "").replace(/^skill[._]/, "");
    },

    /**
     * What a skill is called on screen.
     *
     * The manifest carries a written, translated title — "Calendario: cancella appuntamenti" — and
     * until now nothing read it: every label in the configuration screen was `skillDisplayName`,
     * which strips the `skill_` prefix and hands back the identifier. So a person choosing between
     * authorisations was reading `calendar_event_delete`, which is the name of a row in a file and
     * not the name of anything they configured.
     */
    skillTitle: function(skillObj, lang) {
        const title = skillObj && skillObj.manifest && skillObj.manifest.title;
        if (title) {
            const written = title[lang] || title["*"] || title["en"]
                || Object.values(title).find(v => typeof v === "string" && v);
            if (written) return written;
        }
        return this.skillDisplayName((skillObj && skillObj.name) || "");
    },

    /**
     * What to call one instance on screen: the skill's name, and a number when there is more than
     * one of that skill anywhere in the configuration.
     *
     * THE NUMBER IS THE ONE IN THE INSTANCE ID, not the instance's position. Position was wrong in
     * two ways that both reached the screen. It repeated: it counted within a phase, so the same
     * skillconfigured once in `during` and once in `final` produced two cards both called "#1", and an
     * authorisation labelled that way named two different things. And it moved: a new instance is
     * added at the head of its phase, so creating one renumbered every card below it, which is a
     * poor property for a card and a disqualifying one for the label of a stored authorisation.
     *
     * `_nextInstanceId` takes the maximum suffix across all three phases and adds one, so the
     * suffix is unique per skill in the whole configuration and is assigned once, at creation.
     */
    instanceDisplayLabel: function(skillObj, entry, allEntries, lang) {
        const base = this.skillTitle(skillObj, lang) || this.skillDisplayName(entry.skill);
        if (!skillObj || !this.isMultiInstance(skillObj)) return base;
        const assigned = (entry.instanceId || "").match(/_(\d+)$/);
        if (!assigned) {
            // No id to show. Position is all there is, and it is only used for entries written
            // before instance ids existed, which are single ones in practice.
            const sameSkill = (allEntries || []).filter(e => e.skill === entry.skill);
            return sameSkill.length <= 1 ? base : `${base} #${sameSkill.indexOf(entry) + 1}`;
        }
        // ALWAYS, not only when there are several. The number used to appear once a second
        // instance existed and vanish again when it was deleted, so the name of a thing changed
        // because of something that happened to a different thing — and an authorisation stored
        // under that name suddenly pointed at a label nobody could find. A name that identifies
        // must not depend on what else exists.
        return `${base} #${assigned[1]}`;
    },

    phaseEntryCount: function(config, phase) {
        return (config[phase] || []).length;
    },

    /**
     * Get remaining capacity description for a skill in a phase.
     * Returns null if unlimited, or a string like "2/3" or "max reached".
     */
    capacityLabel: function(config, skill, phase) {
        const ic = this.getInstancesConfig(skill);
        if (ic.maxPerPhase === null && ic.max === null) return null;

        const phaseCount = this.countPhaseInstances(config, skill.name, phase);
        if (ic.maxPerPhase !== null) {
            return `${phaseCount}/${ic.maxPerPhase}`;
        }
        if (ic.max !== null) {
            const totalCount = this.countAllInstances(config, skill.name);
            return `${totalCount}/${ic.max}`;
        }
        return null;
    },

    // --- Internal ---

    /**
     * The id for a new instance: `<outputPrefix>_<n>`, with n one past the highest in use.
     *
     * AND PAST ANY THAT AN AUTHORISATION STILL NAMES, which is the whole reason this takes a
     * second argument. An authorisation is stored under the instance id, and deleting a card does
     * not revoke it: the grant outlives the instance. With the highest number taken only from the
     * instances PRESENT, deleting the last one freed its number, the next instance created took it
     * back, and that instance was connected — silently, with no button pressed — to the Google
     * account of the card that had been deleted. Measured 2026-09-21: with x_1, x_2, x_3 and x_3
     * removed, this returned x_3.
     *
     * An id is therefore never reused while anything still refers to it. The sequence can leave
     * gaps, and gaps are fine: a number here identifies, it does not count.
     */
    _nextInstanceId: function(config, skillObj, reservedIds) {
        const prefix = this.getOutputPrefix(skillObj);
        const taken = new Set(reservedIds || []);
        let maxIdx = 0;
        for (const phase of ["prefetch", "during", "final"]) {
            for (const entry of config[phase] || []) {
                if (entry.skill === skillObj.name && entry.instanceId) {
                    const match = entry.instanceId.match(/_(\d+)$/);
                    if (match) maxIdx = Math.max(maxIdx, parseInt(match[1]));
                }
            }
        }
        for (const id of taken) {
            const match = typeof id === "string" && id.startsWith(`${prefix}_`)
                ? id.match(/_(\d+)$/) : null;
            if (match) maxIdx = Math.max(maxIdx, parseInt(match[1]));
        }
        return `${prefix}_${maxIdx + 1}`;
    }
};
