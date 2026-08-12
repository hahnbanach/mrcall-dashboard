import axios from "axios";

const REALM = "mrcall0";
const BASE = process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/${REALM}`;

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

export default {
    listTemplates: function(user) {
        return axios.get(BASE + "/agent/templates", {
            headers: getHeaders(user)
        });
    },
    getTemplate: function(user, name) {
        return axios.get(BASE + "/agent/templates/" + encodeURIComponent(name), {
            headers: getHeaders(user)
        });
    },
    createTemplate: function(user, data) {
        return axios.post(BASE + "/agent/templates", data, {
            headers: getHeaders(user)
        });
    },
    updateTemplate: function(user, name, data) {
        return axios.put(BASE + "/agent/templates/" + encodeURIComponent(name), data, {
            headers: getHeaders(user)
        });
    },
    deleteTemplate: function(user, name) {
        return axios.delete(BASE + "/agent/templates/" + encodeURIComponent(name), {
            headers: getHeaders(user)
        });
    },
    getVersions: function(user, name) {
        return axios.get(BASE + "/agent/templates/" + encodeURIComponent(name) + "/versions", {
            headers: getHeaders(user)
        });
    },
    rollbackVersion: function(user, name, version) {
        return axios.post(BASE + "/agent/templates/" + encodeURIComponent(name) + "/rollback/" + encodeURIComponent(version), {}, {
            headers: getHeaders(user)
        });
    },
    listTools: function(user) {
        return axios.get(BASE + "/agent/tools", {
            headers: getHeaders(user)
        });
    },
    runAgent: function(user, requestBody) {
        return axios.post(BASE + "/agent/run", requestBody, {
            headers: getHeaders(user),
            timeout: 120000
        });
    },
    testAgent: function(user, requestBody) {
        return axios.post(BASE + "/agent/test", requestBody, {
            headers: getHeaders(user),
            timeout: 120000
        });
    }
}
