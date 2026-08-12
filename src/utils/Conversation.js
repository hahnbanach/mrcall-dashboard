import axios from "axios";

const BASE_URL = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/customer/conversation";

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

export default {
    conversations: function(user, request) {
        return axios.post(BASE_URL + "/search",
            request,
            {
                headers: getHeaders(user)
            }
        ).then((response) => {
            const hits = new Map()
            let totalHits = 0
            let hitsCount = 0
            let maxScore = 0.0
            if(response.data && response.data.length !== 0) {
                response.data.hits.forEach(function (item) {
                    //console.log(item)
                    hits.set(item.document.id, item.document)
                })
                totalHits = response.data.totalHits
                hitsCount = response.data.hitsCount
                maxScore = response.data.maxScore
            }
            return {
                totalHits,
                hits,
                hitsCount,
                maxScore
            }
        })
    },
    archive: function(user, id) {
        return axios.post(BASE_URL + "/archive?value=true",
            { id: id },
            { headers: getHeaders(user) }
        );
    },
    unarchive: function(user, id) {
        return axios.post(BASE_URL + "/archive?value=false",
            { id: id },
            { headers: getHeaders(user) }
        );
    },
    softDelete: function(user, id) {
        return axios.post(BASE_URL + "/delete?value=true",
            { id: id },
            { headers: getHeaders(user) }
        );
    },
    undelete: function(user, id) {
        return axios.post(BASE_URL + "/delete?value=false",
            { id: id },
            { headers: getHeaders(user) }
        );
    },
    bulkArchive: function(user, searchFilter) {
        return axios.post(BASE_URL + "/archive?value=true",
            searchFilter,
            { headers: getHeaders(user) }
        );
    },
    bulkUnarchive: function(user, searchFilter) {
        return axios.post(BASE_URL + "/archive?value=false",
            searchFilter,
            { headers: getHeaders(user) }
        );
    },
    bulkDelete: function(user, searchFilter) {
        return axios.post(BASE_URL + "/delete?value=true",
            searchFilter,
            { headers: getHeaders(user) }
        );
    },
    bulkUndelete: function(user, searchFilter) {
        return axios.post(BASE_URL + "/delete?value=false",
            searchFilter,
            { headers: getHeaders(user) }
        );
    },
    updateProperties: function(user, id, properties) {
        return axios.post(BASE_URL + "/properties?id=" + encodeURIComponent(id),
            properties,
            { headers: getHeaders(user) }
        );
    },
    markAsRead: function(user, id) {
        return this.updateProperties(user, id, [
            { name: "MARKASREAD", value: "true", type: "boolean" }
        ]);
    },
    markAsUnread: function(user, id) {
        return this.updateProperties(user, id, [
            { name: "MARKASREAD", value: "false", type: "boolean" }
        ]);
    }
}
