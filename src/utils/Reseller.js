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
    getManagedOwners: function(user) {
        return axios.get(BASE + "/reseller/managed-owners", {
            headers: getHeaders(user)
        });
    },
    getProfile: function(user) {
        return axios.get(BASE + "/reseller/profile", {
            headers: getHeaders(user)
        });
    },
    getManagedBy: function(user) {
        return axios.get(BASE + "/reseller/managed-by", {
            headers: getHeaders(user)
        });
    },
    getInvitationCodes: function(user) {
        return axios.get(BASE + "/reseller/invitation-codes", {
            headers: getHeaders(user)
        });
    },
    generateInvitationCode: function(user, data) {
        return axios.post(BASE + "/reseller/invitation-codes", data, {
            headers: getHeaders(user)
        });
    },
    deactivateCode: function(user, code) {
        return axios.delete(BASE + "/reseller/invitation-codes/" + encodeURIComponent(code), {
            headers: getHeaders(user)
        });
    },
    claimCode: function(user, code) {
        return axios.post(BASE + "/reseller/claim-code", { code: code }, {
            headers: getHeaders(user)
        });
    },
    getCustomerRegistry: function(user, uid) {
        return axios.get(BASE + "/crm/customer/registry?id=" + encodeURIComponent(uid), {
            headers: getHeaders(user)
        });
    }
}
