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
    getUser: function(user, uid) {
        return axios.get(BASE + "/admin/user?id=" + encodeURIComponent(uid), {
            headers: getHeaders(user)
        });
    },
    getUserByEmail: function(user, email) {
        return axios.get(BASE + "/admin/user?email=" + encodeURIComponent(email), {
            headers: getHeaders(user)
        });
    },
    setUserRole: function(user, uid, role) {
        return axios.post(BASE + "/admin/user", { id: uid, data: { role: role } }, {
            headers: getHeaders(user)
        });
    },
    resetUserRole: function(user, uids) {
        return axios.delete(BASE + "/admin/user", {
            headers: getHeaders(user),
            data: { ids: uids }
        });
    },
    getResellerProfiles: function(user, resellerId) {
        let url = BASE + "/admin/reseller-profiles";
        if (resellerId) url += "?resellerId=" + encodeURIComponent(resellerId);
        return axios.get(url, {
            headers: getHeaders(user)
        });
    },
    createResellerProfile: function(user, data) {
        return axios.post(BASE + "/admin/reseller-profiles", data, {
            headers: getHeaders(user)
        });
    },
    updateResellerProfile: function(user, data) {
        return axios.put(BASE + "/admin/reseller-profiles", data, {
            headers: getHeaders(user)
        });
    },
    deleteResellerProfile: function(user, resellerId) {
        return axios.delete(BASE + "/admin/reseller-profiles?resellerId=" + encodeURIComponent(resellerId), {
            headers: getHeaders(user)
        });
    },
    getResellerMappings: function(user, params) {
        let url = BASE + "/admin/reseller-mappings";
        const queryParts = [];
        if (params?.resellerId) queryParts.push("resellerId=" + encodeURIComponent(params.resellerId));
        if (params?.ownerId) queryParts.push("ownerId=" + encodeURIComponent(params.ownerId));
        if (queryParts.length) url += "?" + queryParts.join("&");
        return axios.get(url, {
            headers: getHeaders(user)
        });
    },
    createResellerMapping: function(user, data) {
        return axios.post(BASE + "/admin/reseller-mappings", data, {
            headers: getHeaders(user)
        });
    },
    deleteResellerMapping: function(user, data) {
        return axios.delete(BASE + "/admin/reseller-mappings", {
            headers: getHeaders(user),
            data: data
        });
    },
    getFeeRates: function(user, params) {
        let url = BASE + "/admin/reseller-fee-rates";
        const queryParts = [];
        if (params?.resellerId) queryParts.push("resellerId=" + encodeURIComponent(params.resellerId));
        if (params?.targetType) queryParts.push("targetType=" + encodeURIComponent(params.targetType));
        if (params?.targetName) queryParts.push("targetName=" + encodeURIComponent(params.targetName));
        if (queryParts.length) url += "?" + queryParts.join("&");
        return axios.get(url, {
            headers: getHeaders(user)
        });
    },
    createFeeRate: function(user, data) {
        return axios.post(BASE + "/admin/reseller-fee-rates", data, {
            headers: getHeaders(user)
        });
    },
    updateFeeRate: function(user, data) {
        return axios.put(BASE + "/admin/reseller-fee-rates", data, {
            headers: getHeaders(user)
        });
    },
    deleteFeeRate: function(user, params) {
        let url = BASE + "/admin/reseller-fee-rates";
        url += "?resellerId=" + encodeURIComponent(params.resellerId);
        url += "&targetType=" + encodeURIComponent(params.targetType);
        url += "&targetName=" + encodeURIComponent(params.targetName);
        return axios.delete(url, {
            headers: getHeaders(user)
        });
    },
    getResellerInvitationCodes: function(user, resellerId) {
        let url = BASE + "/admin/reseller-invitation-codes";
        if (resellerId) url += "?resellerId=" + encodeURIComponent(resellerId);
        return axios.get(url, {
            headers: getHeaders(user)
        });
    },
    deactivateResellerInvitationCode: function(user, code) {
        return axios.delete(BASE + "/admin/reseller-invitation-codes?code=" + encodeURIComponent(code), {
            headers: getHeaders(user)
        });
    },
    removeReseller: function(user, resellerId) {
        return axios.delete(BASE + "/admin/reseller/" + encodeURIComponent(resellerId), {
            headers: getHeaders(user)
        });
    },
    transferOwner: function(user, data) {
        return axios.put(BASE + "/admin/reseller-mappings/transfer", data, {
            headers: getHeaders(user)
        });
    }
}
