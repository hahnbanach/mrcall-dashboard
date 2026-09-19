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
    addSkillToPhase: function(config, skillObj, phase) {
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
            entry.instanceId = this._nextInstanceId(config, skillObj);
        }

        newConfig[phase].push(entry);
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

    instanceDisplayLabel: function(skillObj, entry, allEntriesInPhase) {
        const base = this.skillDisplayName(entry.skill);
        if (!skillObj || !this.isMultiInstance(skillObj)) return base;
        const sameSkill = allEntriesInPhase.filter(e => e.skill === entry.skill);
        if (sameSkill.length <= 1) return base;
        const idx = sameSkill.indexOf(entry) + 1;
        return `${base} #${idx}`;
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

    _nextInstanceId: function(config, skillObj) {
        const prefix = this.getOutputPrefix(skillObj);
        let maxIdx = 0;
        for (const phase of ["prefetch", "during", "final"]) {
            for (const entry of config[phase] || []) {
                if (entry.skill === skillObj.name && entry.instanceId) {
                    const match = entry.instanceId.match(/_(\d+)$/);
                    if (match) maxIdx = Math.max(maxIdx, parseInt(match[1]));
                }
            }
        }
        return `${prefix}_${maxIdx + 1}`;
    }
};
