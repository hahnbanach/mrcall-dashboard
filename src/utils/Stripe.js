import axios from "axios";

export default {
    async createSession(user, templateName, businessId, successUrl, cancelUrl){
        const headers = {
            "Content-type": "application/json; charset=UTF-8",
            "auth": user.accessToken
        };
        const sessionIn = {
            businessId: businessId,
            successUrl: successUrl,
            cancelUrl: cancelUrl
        }
        console.log(headers, sessionIn)
        return axios.post(process.env.VUE_APP_STARCHAT_URL + "/stripe/v1/mrcall0/session/business",
            sessionIn,
            {
                headers: headers
            }
        ).then((response) => {
            console.debug("SelectedTemplate:", response);
            if (response.status === 200) {
                if(response.data) {
                    return response.data
                } else {
                    throw new Error(`Session data was empty: ${response}`);
                }
            } else {
                const message = `Unable to generate session: ${response}`
                throw new Error(message);
            }
        }) ;
    }
}