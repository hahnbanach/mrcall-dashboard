import axios from "axios";

const REALM = "mrcall0";
const BASE_URL = process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/${REALM}/mcp/connectors`;

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

export default {
    /**
     * Read static info needed to configure a client (no credentials):
     *   { mcp_url, well_known_protected_resource, well_known_auth_server,
     *     authorization_endpoint, token_endpoint, allowed_scopes,
     *     redirect_uris, instructions: { summary, claude_ai } }
     */
    info: function (user) {
        return axios.get(
            BASE_URL + "/info",
            { headers: getHeaders(user) }
        ).then((response) => response.data);
    },

    /**
     * List connectors owned by the authenticated user (no secrets).
     * Response: McpConnectorListItem[] = [{ clientId, oauthRealm, createdAt }, ...]
     */
    list: function (user) {
        return axios.get(
            BASE_URL,
            { headers: getHeaders(user) }
        ).then((response) => response.data);
    },

    /**
     * Mint a new MCP connector. The client_secret is returned ONCE and is not
     * recoverable afterwards (only the hash is stored server-side); the caller
     * must show it to the user with the standard reveal-once UX.
     *
     * Payload: { name, description? }
     * Response: McpConnectorMintResponse = {
     *   clientId, clientSecret, clientName,
     *   oauthRealm, redirectUris, allowedScopes, createdAt
     * }
     */
    create: function (user, payload) {
        return axios.post(
            BASE_URL,
            payload || {},
            { headers: getHeaders(user) }
        ).then((response) => response.data);
    },

    /**
     * Rotate the client_secret of an existing connector. Old secret is
     * invalidated immediately. New secret returned ONCE.
     *
     * Response: { clientSecret: string }
     */
    rotateSecret: function (user, clientId) {
        return axios.post(
            BASE_URL + `/${encodeURIComponent(clientId)}/rotate-secret`,
            {},
            { headers: getHeaders(user) }
        ).then((response) => response.data);
    }
};
