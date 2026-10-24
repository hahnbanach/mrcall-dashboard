import axios from "axios";

/**
 * Whether a business has an automatic top-up switched on, for one decision only: a request refused for the reserve
 * kept for calls offers "Attiva la ricarica automatica" only to a business that has none
 * (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, acceptance 6). The products and their status are read
 * as the plan page reads them (`Products.vue`): the top-up products of the business's template, and the status of each.
 *
 * What this does NOT decide: whether a top-up is *effective* for the reserve (StarChat's `InsightsReserve` also counts
 * this month's top-ups against the subscription's cap). That rule is the server's alone. A top-up switched on but at
 * its cap this month is "on" here, and rightly not offered to be switched on again.
 *
 * Answers true, false, or null when it cannot be read (then the offer is shown: offering to switch on what is on
 * costs a click on the plan page; hiding it from a business without one leaves it no way out).
 */
const ON = ["ACTIVE", "TRIALING", "EXPIRING"];
const PRODUCT_URL = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/product";

function headers(user) {
    return { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
}

export function topUpOn(user, business, language) {
    if (!user || !business || !business.businessId || !business.template) return Promise.resolve(null);
    return axios.get(PRODUCT_URL + "?language=" + encodeURIComponent(language || "it-IT") + "&template=" + encodeURIComponent(business.template),
        { headers: headers(user) })
        .then((response) => {
            const topUps = (Array.isArray(response.data) ? response.data : [])
                .filter((p) => p && p.productType === "onetime" && p.topup);
            if (topUps.length === 0) return false;
            return Promise.all(topUps.map((p) => axios.get(PRODUCT_URL + "/" + encodeURIComponent(p.productType) + "/status?id=" +
                encodeURIComponent(business.businessId) + "&name=" + encodeURIComponent(p.name), { headers: headers(user) })
                .then((r) => r.data && ON.includes(r.data.status))
                .catch((error) => (error && error.response && error.response.status === 404 ? false : null))))
                .then((states) => (states.some((s) => s === true) ? true : states.some((s) => s === null) ? null : false));
        })
        .catch(() => null);
}
