import axios from "axios";

const BASE_URL = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/template";

export default {
    // The business templates, which are also the plans: a business's plan is its template name.
    list: function(user, language) {
        return axios.get(BASE_URL + "?language=" + encodeURIComponent(language), {
            headers: {
                "Content-type": "application/json; charset=UTF-8",
                "auth": user.accessToken
            }
        });
    }
}
