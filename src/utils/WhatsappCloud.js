import axios from "axios";

const REALM = "mrcall0";
const BASE_URL = process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/${REALM}/whatsapp/cloud`;

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

export default {
    getStatus: function(user, businessId) {
        return axios.get(
            BASE_URL + `/status?businessId=${encodeURIComponent(businessId)}`,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    signupCallback: function(user, credentials) {
        return axios.post(
            BASE_URL + `/signup/callback`,
            credentials,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    sendMessage: function(user, payload) {
        return axios.post(
            BASE_URL + `/send`,
            payload,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    getMessages: function(user, params) {
        const query = new URLSearchParams();
        query.set("businessId", params.businessId);
        if (params.contact) query.set("contact", params.contact);
        if (params.limit) query.set("limit", params.limit);
        if (params.offset !== undefined) query.set("offset", params.offset);
        return axios.get(
            BASE_URL + `/messages?${query.toString()}`,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    getSessionMessages: function(user, sessionId, businessId) {
        return axios.get(
            BASE_URL + `/messages/session?sessionId=${encodeURIComponent(sessionId)}&businessId=${encodeURIComponent(businessId)}`,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    getMedia: function(user, mediaId, businessId) {
        const mediaUrl = process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/${REALM}/whatsapp/media/${encodeURIComponent(mediaId)}`;
        return axios.get(
            mediaUrl + `?businessId=${encodeURIComponent(businessId)}`,
            { headers: getHeaders(user), responseType: "blob" }
        ).then((response) => {
            return response.data;
        });
    },
    revokeCredentials: function(user, businessId) {
        return axios.delete(
            BASE_URL + `/credentials?businessId=${encodeURIComponent(businessId)}`,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.status;
        });
    }
}
