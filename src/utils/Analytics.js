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
    // StarChat cuts the series in this IANA zone and answers 400 to a zone it does not know, rather
    // than charting UTC days under a local label. A caller that forgot it would otherwise send the
    // literal "undefined" (2026-10-04, the business analytics page), so the call is refused here,
    // before the request, and the page reports it like any failed section.
    timeseries: function(user, request, granularity, timezone) {
        if (!timezone) return Promise.reject(new Error("Analytics.timeseries: timezone is required"));
        return axios.post(BASE_URL + "/timeseries?granularity=" + encodeURIComponent(granularity) +
                "&timezone=" + encodeURIComponent(timezone),
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
        if (!timezone) return Promise.reject(new Error("Analytics.hourlyHeatmap: timezone is required"));
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
