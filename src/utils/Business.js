import axios from "axios";
export default {
    moduleDescription: function() {
        console.log("This module implements functions to set business variables")
    },
    toBoolean: function(value) {
        return (value === "true" || value === "True" || value === true)
    },
    setBusinessDefaultValues: function(business, templateName, emailAddress, templateVariables) {
        console.debug("Populating Business with variables:", templateVariables)
        templateVariables.map((collection) => {
            collection.variables.flat().map((parameterSpecification) => {
                if(parameterSpecification.class === "base") {
                    if (parameterSpecification.name === "template") {
                        if (! business[parameterSpecification.name])
                            business[parameterSpecification.name] = templateName
                    } else if (parameterSpecification.name === "emailAddress") {
                        if (!business[parameterSpecification.name])
                            business[parameterSpecification.name] = emailAddress
                    } else if(parameterSpecification.type === "json") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                        else
                            business[parameterSpecification.name] = JSON.parse(business[parameterSpecification.name])
                    } else if (parameterSpecification.type === "string" || parameterSpecification.type === "text" || parameterSpecification.type === "enum") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = parameterSpecification.defaultValue
                    } else if (parameterSpecification.type === "verbatim"){
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = parameterSpecification.defaultValue
                    } else if (parameterSpecification.type === "boolean") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = this.toBoolean(parameterSpecification.defaultValue)
                        else
                            business[parameterSpecification.name] = this.toBoolean(business[parameterSpecification.name])
                    } else if (parameterSpecification.type === "number") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = Number(parameterSpecification.defaultValue)
                        else
                            business[parameterSpecification.name] = Number(business[parameterSpecification.name])
                    } else if (parameterSpecification.type.startsWith("meta:")) {
                        //do nothing
                    } else if(parameterSpecification.type === "tuples") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                        else
                            business[parameterSpecification.name] = JSON.parse(business[parameterSpecification.name])
                    } else if(parameterSpecification.type === "tuple") {
                        //do nothing
                    } else if(parameterSpecification.type === "multiselect") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                        else
                            business[parameterSpecification.name] = JSON.parse(business[parameterSpecification.name])
                    } else if(parameterSpecification.type === "templated") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = parameterSpecification.defaultValue
                    } else if(parameterSpecification.type === "agent_skills") {
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = {}
                        else {
                            try { business[parameterSpecification.name] = JSON.parse(business[parameterSpecification.name]) }
                            catch { business[parameterSpecification.name] = {} }
                        }
                    } else {
                        throw new Error("Invalid variable specification:", parameterSpecification.class, parameterSpecification.name, parameterSpecification.type)
                    }
                } else if(parameterSpecification.class === "variable") {
                    if(parameterSpecification.type === "json") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === "")) {
                            business.variables[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                        } else
                            business.variables[parameterSpecification.name] = JSON.parse(business.variables[parameterSpecification.name])
                    } else if(parameterSpecification.type === "string" || parameterSpecification.type === "text" || parameterSpecification.type === "enum") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === ""))
                            business.variables[parameterSpecification.name] = parameterSpecification.defaultValue
                    } else if (parameterSpecification.type === "verbatim"){
                        if (business[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business[parameterSpecification.name] === ""))
                            business[parameterSpecification.name] = parameterSpecification.defaultValue
                    } else if(parameterSpecification.type === "boolean") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === ""))
                            business.variables[parameterSpecification.name] = this.toBoolean(parameterSpecification.defaultValue)
                        else
                            business.variables[parameterSpecification.name] = this.toBoolean(business.variables[parameterSpecification.name])
                    } else if(parameterSpecification.type === "number") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === ""))
                            business.variables[parameterSpecification.name] = Number(parameterSpecification.defaultValue)
                        else
                            business.variables[parameterSpecification.name] = Number(business.variables[parameterSpecification.name])
                    } else if (parameterSpecification.type.startsWith("meta:")) {
                        //do nothing
                    } else if(parameterSpecification.type === "tuples") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === "")) {
                            try {
                                business.variables[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                            } catch (error) {
                                console.error(`Parsing variable with type(${parameterSpecification.type}), name: ${parameterSpecification.name}, defaultvalue: ${parameterSpecification.defaultValue}`, error);
                            }
                        } else {
                            try {
                                business.variables[parameterSpecification.name] = JSON.parse(business.variables[parameterSpecification.name])
                            } catch (error) {
                                console.error(`Parsing variable with type(${parameterSpecification.type}) and name: ${parameterSpecification.name}, value: ${business.variables[parameterSpecification.name]}`, error);
                            }
                        }
                    } else if(parameterSpecification.type === "tuple") {
                        //do nothing
                    } else if(parameterSpecification.type === "multiselect") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === "")) {
                            try {
                                business.variables[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                            } catch (error) {
                                console.error(`Parsing variable with type(${parameterSpecification.type}), name: ${parameterSpecification.name}, defaultvalue: ${parameterSpecification.defaultValue}`, error);
                            }
                        } else {
                            try {
                                business.variables[parameterSpecification.name] = JSON.parse(business.variables[parameterSpecification.name])
                            } catch (error) {
                                console.error(`Parsing variable with type(${parameterSpecification.type}) and name: ${parameterSpecification.name}, value: ${business.variables[parameterSpecification.name]}`, error);
                            }
                        }
                    }
                    else if(parameterSpecification.type === "templated") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === "")) {
                            business.variables[parameterSpecification.name] = parameterSpecification.defaultValue
                        }
                    } else if(parameterSpecification.type === "agent_skills") {
                        if (business.variables[parameterSpecification.name] === undefined ||
                            (parameterSpecification.mandatory && business.variables[parameterSpecification.name] === "")) {
                            try {
                                business.variables[parameterSpecification.name] = JSON.parse(parameterSpecification.defaultValue)
                            } catch {
                                business.variables[parameterSpecification.name] = {}
                            }
                        } else {
                            try {
                                business.variables[parameterSpecification.name] = JSON.parse(business.variables[parameterSpecification.name])
                            } catch (error) {
                                console.error(`Parsing variable with type(${parameterSpecification.type}) and name: ${parameterSpecification.name}, value: ${business.variables[parameterSpecification.name]}`, error);
                            }
                        }
                    } else {
                        throw new Error("Invalid variable specification:", parameterSpecification.class, parameterSpecification.name, parameterSpecification.type)
                    }
                }
            })
        })
        console.debug("Populated business:", business)
    },
    selectVariables: function(user, languageCountry, languageDescriptions, templateName) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            return axios.get(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/variables?" +
                `nested=true&templateName=${templateName}&language=${languageCountry}&languageDescriptions=${languageDescriptions}`,
                {
                    headers: headers
                }
            ).then((response) => {
                if (response.data) {
                    console.debug("Variables:", response)
                    return response.data
                } else {
                    const message = `No result found for template ${templateName}, ${languageCountry}`
                    throw new Error(message);
                }
            }) ;
        }) ;
    },
    getBusiness: function(store, user, businessId) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            return axios.get(
                `${process.env.VUE_APP_STARCHAT_URL}/mrcall/v1/mrcall0/crm/business?id=${businessId}`,
                {
                    headers: headers
                }
            ).then((response) => {
                console.debug("Retrieved:", response);
                store.commit('setRole', response.headers["x-mrcall-role"] || 'owner')
                const item = response.data.find(e => typeof e !== 'undefined')
                return item;
            }) ;
        }) ;
    },
    chooseBusinessTemplate: function(user, business) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            return axios.put(process.env.VUE_APP_STARCHAT_URL +
                "/mrcall/v1/mrcall0/crm/business/template/onboarding",
                business,
                {
                    headers: headers
                }
            ).then((response) => {
                console.debug("SelectedTemplate:", response);
                if (response.status === 200) {
                    return response.data.result;
                } else {
                    const message = `Business Template updated resulted in an error: ${response}`
                    throw new Error(message);
                }
            }) ;
        }) ;
    },
    updateBusiness: function(user, inBusiness) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            return axios.put(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business",
                inBusiness,
                {
                    headers: headers
                }
            ).then((response) => {
                console.debug("SavedBusines:", response);
                if (response.status === 200 && response.data.score === "1") {
                    return response.data.result;
                } else {
                    const message = `Business updated resulted in an error: ${response}`
                    throw new Error(message);
                }
            }) ;
        }) ;
    },
    checkUserHasBusinesses: function(user, store) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business/search";
            return axios.post(url,
                { offset: 0, limit: 1 },
                { headers }
            ).then((response) => {
                store.commit('setRole', response.headers["x-mrcall-role"] || 'owner');
                return response.data && response.data.length > 0;
            });
        });
    },
    createBusiness: function(user, inBusiness) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            return axios.post(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business",
                inBusiness,
                {
                    headers: headers
                }
            ).then((response) => {
                if (response.data) {
                    console.debug("CreatedBusiness:", response)
                    return response.data
                } else {
                    const message = `Business created resulted as empty: ${inBusiness}`
                    throw new Error(message);
                }
            }) ;
        }) ;
    }
}