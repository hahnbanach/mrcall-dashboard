import axios from "axios";

export default {
    agentRun: function(user, requestBody) {
        return user.getIdToken(true).then(function(accessToken) {
            const headers = {
                "Content-type": "application/json; charset=UTF-8",
                "auth": accessToken
            };
            return axios.post(
                `${process.env.VUE_APP_STARCHAT_URL}/mrcall/v1/mrcall0/agent/run`,
                requestBody,
                { headers }
            ).then((response) => {
                console.debug("AgentRun response:", response);
                return response.data;
            });
        });
    },

    /**
     * Run agent via WebSocket streaming. Stays open for the duration of the
     * job, avoiding reverse-proxy timeouts (504).
     *
     * @param {object} user        Firebase user (has getIdToken)
     * @param {object} requestBody { template, userMessage, sessionId, businessId }
     * @param {object} [opts]
     * @param {Function}        [opts.onProgress] Called with { step, percentage, message }
     * @param {AbortSignal}     [opts.signal]     Abort to close the WebSocket early
     * @returns {Promise<object>} Resolves with the completed result payload
     */
    agentRunWs: function(user, requestBody, { onProgress, signal } = {}) {
        return user.getIdToken(true).then(function(accessToken) {
            return new Promise(function(resolve, reject) {
                if (signal && signal.aborted) {
                    reject(new DOMException("Aborted", "AbortError"));
                    return;
                }

                const httpBase = process.env.VUE_APP_STARCHAT_URL;
                const wsBase = httpBase.replace(/^http/, "ws");
                const wsUrl = `${wsBase}/mrcall/v1/mrcall0/agent/run/stream?auth=${encodeURIComponent(accessToken)}`;

                const ws = new WebSocket(wsUrl);
                let settled = false;

                function settle(fn, value) {
                    if (!settled) {
                        settled = true;
                        fn(value);
                    }
                }

                if (signal) {
                    signal.addEventListener("abort", function() {
                        ws.close(1000, "aborted");
                        settle(reject, new DOMException("Aborted", "AbortError"));
                    }, { once: true });
                }

                ws.onopen = function() {
                    ws.send(JSON.stringify(requestBody));
                };

                ws.onmessage = function(event) {
                    let msg;
                    try {
                        msg = JSON.parse(event.data);
                    } catch {
                        console.warn("AgentRunWs: non-JSON message", event.data);
                        return;
                    }

                    switch (msg.type) {
                        case "ack":
                            console.debug("AgentRunWs ack, jobId:", msg.jobId);
                            break;
                        case "progress":
                            if (onProgress) onProgress(msg);
                            break;
                        case "completed":
                            console.debug("AgentRunWs completed:", msg.result);
                            settle(resolve, msg.result);
                            break;
                        case "error":
                            console.error("AgentRunWs error:", msg.error);
                            settle(reject, new Error(msg.error));
                            break;
                        case "ping":
                            break;
                        default:
                            console.debug("AgentRunWs unknown message type:", msg.type);
                    }
                };

                ws.onerror = function(event) {
                    console.error("AgentRunWs WebSocket error", event);
                    settle(reject, new Error("WebSocket connection failed"));
                };

                ws.onclose = function(event) {
                    if (!settled) {
                        if (event.code === 1000) {
                            settle(reject, new Error("WebSocket closed before completion"));
                        } else {
                            settle(reject, new Error(
                                "WebSocket closed unexpectedly (code " + event.code + ")"
                            ));
                        }
                    }
                };
            });
        });
    }
}
