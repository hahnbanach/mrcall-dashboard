import axios from "axios";

const REALM = "mrcall0";
const BASE_URL = process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/${REALM}/crm/contact`;

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

export default {
    /**
     * Search contacts with pagination.
     * Uses POST /search with CrmContactSearch body.
     * Response: { text, score, result: CrmContact[], totalHits }
     */
    search: function(user, businessId, searchCriteria) {
        return axios.post(
            BASE_URL + `/search?businessId=${encodeURIComponent(businessId)}`,
            searchCriteria || {},
            { headers: getHeaders(user) }
        ).then((response) => {
            const data = response.data;
            if (data && data.result) {
                return {
                    contacts: Array.isArray(data.result) ? data.result : [data.result],
                    totalHits: data.totalHits || 0
                };
            }
            if (Array.isArray(data)) {
                return { contacts: data, totalHits: data.length };
            }
            if (data) {
                return { contacts: [data], totalHits: 1 };
            }
            return { contacts: [], totalHits: 0 };
        });
    },
    create: function(user, businessId, contact, options) {
        const params = new URLSearchParams({ businessId });
        if (options && options.language) params.set("language", options.language);
        if (options && options.countryAlpha2) params.set("countryAlpha2", options.countryAlpha2);
        return axios.post(
            BASE_URL + `?${params.toString()}`,
            contact,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    update: function(user, businessId, contact) {
        return axios.put(
            BASE_URL + `?businessId=${encodeURIComponent(businessId)}`,
            contact,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.data;
        });
    },
    delete: function(user, businessId, contactId) {
        return axios.delete(
            BASE_URL + `?businessId=${encodeURIComponent(businessId)}&contactId=${encodeURIComponent(contactId)}`,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.status;
        });
    },
    deleteAll: function(user, businessId) {
        return axios.post(
            BASE_URL + `/delete/all?businessId=${encodeURIComponent(businessId)}`,
            null,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.status;
        });
    },
    bulkResync: function(user, businessId, contacts, options) {
        const params = new URLSearchParams({ businessId });
        if (options && options.countryAlpha2) params.set("countryAlpha2", options.countryAlpha2);
        if (options && options.nameFilter !== undefined) params.set("nameFilter", options.nameFilter);
        return axios.post(
            BASE_URL + `/upload/bulk?${params.toString()}`,
            contacts,
            { headers: getHeaders(user) }
        ).then((response) => {
            return response.status;
        });
    }
}
