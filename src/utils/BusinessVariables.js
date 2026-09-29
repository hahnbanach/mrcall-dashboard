export default {
    isVariableVisible: function(variable, isAdmin, advancedMode) {
        if(variable.name === 'languageCountry') {
            return false; // disabled because change is not yet supported
        } else if(variable.visible && variable.advanced && advancedMode) {
            return true
        } else if (!variable.visible && isAdmin) {
            return true
        } else if(variable.visible && ! variable.advanced) {
            return true
        }
        return false
    },
    shouldShowInput: function(business, variable) {
        return !this.checkIfDisabledByParents(business, variable);
    },
    checkModifiable: function(variable, isAdmin) {
        return (variable.modifiable || isAdmin);
    },
    extractExpectedValueFromVariableName: function(name) {
        let nameWithoutModifier = name ;
        let invert = false
        if(name.startsWith("!")) {
            nameWithoutModifier = name.replace(/^!/, '')
            invert = true
        }
        const startsFrom = nameWithoutModifier.indexOf('(');
        if (startsFrom === -1) {
            return [invert, nameWithoutModifier, null];
        }

        const endsAt = nameWithoutModifier.indexOf(')');
        if (endsAt === -1) {
            return [invert, nameWithoutModifier, null];
        }

        const depName = nameWithoutModifier.substring(0, startsFrom)
        const depValue = nameWithoutModifier.substring(startsFrom + 1, endsAt)
        return [invert, depName, depValue];
    },
    checkIfDisabledByParentsDecorator: function(business, variable, isAdmin) {
        const dependsOn = variable.dependsOn
        console.debug("DEPENDS_ON Decorator:", variable.name, dependsOn)
        if(dependsOn.length <= 0 || !this.checkModifiable(variable, isAdmin)) {
            return !this.checkModifiable(variable, isAdmin)
        }
        return this.checkIfDisabledByParents(business, variable);
    },
    checkIfDisabledByParents: function(business, variable, overrideDependsOn = undefined) {
        let dependsOn = variable.dependsOn
        if(overrideDependsOn) {
            dependsOn = overrideDependsOn ;
        }
        console.debug("DEPENDS_ON:", variable.name, dependsOn)

        if(dependsOn.length === 0) {
            return false ;
        }

        let enabledByParent = dependsOn.reduce((acc, item) => {
            console.debug("BUSINESS_DEPENDENCIES:", acc, name, business)
            const enabled = item.reduce((acc, name) => {
                console.debug("BUSINESS_DEPENDENCIES_ACC_NAME:", acc, name, business)
                const [invert, variableName, variableExpectedValue] = this.extractExpectedValueFromVariableName(name);
                if (variableExpectedValue) { //a match with a value other than boolean is required
                    if (!(variableName in business.variables)) {
                        return false;
                    }
                    const variableValue = business.variables[variableName]
                    let comparisonResult = String(variableValue) === String(variableExpectedValue)
                    if (invert) {
                        comparisonResult = !comparisonResult
                    }
                    console.debug(`Variable (${variable.name}) invert(${invert}) Depends on ${variableName}, with value: ${variableValue} result(${comparisonResult})`,)
                    return acc && comparisonResult
                } else {
                    let variableValue = business.variables[name] // boolean value match
                    if(invert) {
                        variableValue = !variableValue
                    }
                    console.debug(`Variable (${variable.name}) invert(${invert}) Depends on ${name}, with value: ${variableValue}`)

                    const level1Result = acc && variableValue === true;
                    console.debug("BUSINESS_DEPENDENCIES_L1RES:", item, level1Result);
                    return level1Result;
                }
            }, true)

            return (acc || enabled) ;
        }, false);

        const blockedByParent = ! enabledByParent;
        if(blockedByParent) {
            console.debug("DISABLED:", variable, blockedByParent, this.checkModifiable(variable))
        } else {
            console.debug("ENABLED:", variable, blockedByParent, this.checkModifiable(variable))
        }
        return blockedByParent ;
    },
    /**
     * The values of a templated variable this business may choose: those whose own dependsOn holds
     * for the business as it is now, and whose language is the business's.
     *
     * Each value carries its own condition because a value can be right under one setting and
     * wrong under another: a GPT-Live voice is a voice the Realtime engine refuses, and a Realtime
     * call with it hears nothing (test, 2026-09-29). Read again whenever the business changes, so
     * switching the engine changes the voices offered at once.
     */
    templatedOptions(business, variable) {
        const values = (variable.templatedVariable && variable.templatedVariable.values) || {}
        const languageCountry = business.languageCountry || ""
        const lang = languageCountry.substring(0, 2)
        return Object.entries(values)
            .filter(([, item]) => !this.checkIfDisabledByParents(business, variable, item.dependsOn || []))
            .filter(([, item]) => {
                if (!item.language || item.language === "*") return true
                return item.language.length > 2 ? item.language === languageCountry : item.language === lang
            })
            .map(([key, item]) => ({ label: item.label || key, value: key, description: item.description, language: item.language }))
    },
    /**
     * The value a templated variable holds when the business may no longer choose it, as when the
     * engine was changed after the voice: undefined when the value is empty or still offered.
     * It is kept rather than cleared, since an empty value would reach the server as "null", and
     * saving is refused until another one is chosen.
     */
    unavailableTemplatedValue(business, variable) {
        const value = business.variables[variable.name]
        if (value === undefined || value === null || value === "" || Array.isArray(value)) return undefined
        const offered = this.templatedOptions(business, variable).some(o => o.value === value)
        if (offered) return undefined
        const item = ((variable.templatedVariable && variable.templatedVariable.values) || {})[value]
        return { value: value, label: (item && item.label) || value }
    },
    businessVariablesToSerializable(inBusiness) {
        let business = {}
        for (const item of Object.entries(inBusiness)) {
            if(item[0] === "variables") {
                let variables = {}
                for (const variable of Object.entries(item[1])) {
                    if(typeof(variable[1]) === "object") {
                        variables[variable[0]] = JSON.stringify(variable[1])
                    } else {
                        variables[variable[0]] = variable[1].toString()
                    }
                }
                business['variables'] = variables
            } else {
                business[item[0]] = item[1]
            }
        }
        return business
    }
}