import axios from "axios";

const BASE_URL = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/customer/analytics";

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

export default {
    dashboard: function(user, request) {
        return axios.post(BASE_URL + "/dashboard",
            request,
            { headers: getHeaders(user) }
        );
    },
    timeseries: function(user, request, granularity) {
        return axios.post(BASE_URL + "/timeseries?granularity=" + encodeURIComponent(granularity),
            request,
            { headers: getHeaders(user) }
        );
    },
    durationDistribution: function(user, request) {
        return axios.post(BASE_URL + "/duration-distribution",
            request,
            { headers: getHeaders(user) }
        );
    },
    hourlyHeatmap: function(user, request, timezone) {
        return axios.post(BASE_URL + "/hourly-heatmap?timezone=" + encodeURIComponent(timezone),
            request,
            { headers: getHeaders(user) }
        );
    },
    callers: function(user, request, limit) {
        return axios.post(BASE_URL + "/callers?limit=" + encodeURIComponent(limit),
            request,
            { headers: getHeaders(user) }
        );
    },
    businessBreakdown: function(user, request) {
        return axios.post(BASE_URL + "/business-breakdown",
            request,
            { headers: getHeaders(user) }
        );
    }
}
