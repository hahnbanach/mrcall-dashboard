/**
 * Zylch AI Chat API utilities
 *
 * Provides functions to interact with Zylch AI backend for chat functionality.
 * All requests require Firebase authentication token.
 */

import axios from "axios";

export default {
  /**
   * Send a message to Zylch AI and get response
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} message - Message or command to send
   * @param {string|null} sessionId - Optional session ID to continue conversation
   * @returns {Promise<Object>} Response with assistant message and session info
   */
  /**
   * Send a message to Zylch AI and get response
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} message - Message or command to send
   * @param {string|null} sessionId - Optional session ID to continue conversation
   * @param {Array|null} attachments - Optional file attachments [{name, type, data (base64)}]
   * @returns {Promise<Object>} Response with assistant message and session info
   */
  sendMessage: function(user, message, sessionId = null, attachments = null) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken,
      "X-Client-Source": "mrcall_dashboard"
    };

    const payload = {
      message: message
    };

    if (sessionId) {
      payload.session_id = sessionId;
    }

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(att => ({
        name: att.name,
        media_type: att.type,
        data: att.data,
      }));
    }

    return axios.post(
      process.env.VUE_APP_ZYLCH_URL + "/api/chat/message",
      payload,
      { headers: headers }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error sending message:", error);
      throw error;
    });
  },

  /**
   * Send a message to Zylch AI with streaming SSE response
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} message - Message or command to send
   * @param {Object} callbacks - Event callbacks:
   *   - onTextDelta(text): incremental text chunk
   *   - onToolResult(toolUsed, result): tool execution result
   *   - onMetadata(metadata): pending_changes and other metadata
   *   - onProgress(phase, text): liveness/status update (e.g. "Thinking…",
   *     "Searching the web…", heartbeat "·"). UI should render as a
   *     transient line and clear on the next onTextDelta / onDone.
   *   - onError(message): error occurred
   *   - onDone(sessionId): stream complete
   * @param {string|null} sessionId - Optional session ID
   * @param {Array|null} attachments - Optional file attachments
   * @returns {Function} abort function to cancel the stream
   */
  sendMessageStream: function(user, message, callbacks = {}, sessionId = null, attachments = null) {
    const url = process.env.VUE_APP_ZYLCH_URL + "/api/chat/message/stream";

    const payload = { message };
    if (sessionId) payload.session_id = sessionId;
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(att => ({
        name: att.name,
        media_type: att.type,
        data: att.data,
      }));
    }

    const controller = new AbortController();

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + user.accessToken,
        "X-Client-Source": "mrcall_dashboard",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        if (callbacks.onError) callbacks.onError(`HTTP ${response.status}: ${text}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (data: {...}\n\n)
        const lines = buffer.split("\n\n");
        buffer = lines.pop(); // Keep incomplete chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "text_delta":
                if (callbacks.onTextDelta) callbacks.onTextDelta(event.text);
                break;
              case "text_replace":
                // Replace entire streamed text with properly decoded version
                if (callbacks.onTextReplace) callbacks.onTextReplace(event.text);
                break;
              case "tool_result":
                if (callbacks.onToolResult) callbacks.onToolResult(event.tool_used, event.result);
                break;
              case "metadata":
                if (callbacks.onMetadata) callbacks.onMetadata(event);
                break;
              case "progress":
                if (callbacks.onProgress) callbacks.onProgress(event.phase, event.text);
                break;
              case "error":
                if (callbacks.onError) callbacks.onError(event.message);
                break;
              case "done":
                if (callbacks.onDone) callbacks.onDone(event.session_id);
                break;
            }
          } catch (e) {
            console.warn("Failed to parse SSE event:", line, e);
          }
        }
      }
    }).catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Stream error:", error);
        if (callbacks.onError) callbacks.onError(error.message);
      }
    });

    // Return abort function
    return () => controller.abort();
  },

  /**
   * Get conversation history for current user
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string|null} sessionId - Optional session ID (uses latest if not provided)
   * @param {number} limit - Maximum messages to retrieve (default: 50)
   * @returns {Promise<Object>} History with messages array
   */
  getHistory: function(user, sessionId = null, limit = 50) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    const params = { limit };
    if (sessionId) {
      params.session_id = sessionId;
    }

    return axios.get(
      process.env.VUE_APP_ZYLCH_URL + "/api/chat/history",
      { headers: headers, params: params }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error retrieving history:", error);
      throw error;
    });
  },

  /**
   * List all chat sessions for current user
   *
   * @param {Object} user - Firebase user object with accessToken
   * @returns {Promise<Object>} Sessions list with metadata
   */
  listSessions: function(user) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    return axios.get(
      process.env.VUE_APP_ZYLCH_URL + "/api/chat/sessions",
      { headers: headers }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error listing sessions:", error);
      throw error;
    });
  },

  /**
   * Delete a chat session
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<Object>} Success confirmation
   */
  deleteSession: function(user, sessionId) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    return axios.delete(
      process.env.VUE_APP_ZYLCH_URL + `/api/chat/session/${sessionId}`,
      { headers: headers }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error deleting session:", error);
      throw error;
    });
  },

  // getTrainingStatus / startTraining / resetVariables removed 2026-07-13:
  // dead code, zero callers anywhere in src/. They wrapped
  // /api/mrcall/training/{status,start,reset} on mrcall-agent, all three
  // of which were removed server-side the same day as confirmed dead code
  // (no dashboard UI ever called them; see
  // ~/hb/docs/known-issues-and-solutions.md).

  /**
   * Get background job status (for polling training progress)
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} jobId - Job UUID
   * @returns {Promise<Object>} Job status with progress_pct, status, etc.
   */
  getJobStatus: function(user, jobId) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    return axios.get(
      process.env.VUE_APP_ZYLCH_URL + `/api/jobs/${jobId}`,
      { headers: headers }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error fetching job status:", error);
      throw error;
    });
  },

  /**
   * Get any active (pending/running) job for a business_id
   *
   * Job-type agnostic — returns any job (training, configure, reset, etc.)
   * that is active for this business. Used by frontends to determine if
   * the chat should be blocked.
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} businessId - MrCall business ID
   * @returns {Promise<Object>} {active: true, job_id, job_type, status, progress_pct, status_message}
   *                            or {active: false}
   */
  getActiveJob: function(user, businessId) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    return axios.get(
      process.env.VUE_APP_ZYLCH_URL + `/api/jobs/active`,
      { headers: headers, params: { business_id: businessId } }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error checking active job:", error);
      throw error;
    });
  },

  /**
   * Stop a running background job
   *
   * Sets the job to 'cancelled' status. The worker thread detects
   * this and exits gracefully at the next checkpoint.
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} jobId - Job UUID to stop
   * @returns {Promise<Object>} {cancelled: true} on success
   */
  stopJob: function(user, jobId) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    return axios.post(
      process.env.VUE_APP_ZYLCH_URL + `/api/jobs/${jobId}/stop`,
      {},
      { headers: headers }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error stopping job:", error);
      throw error;
    });
  },

  /**
   * Apply pending configuration changes to StarChat
   *
   * Called by the Save button to commit staged changes.
   *
   * @param {Object} user - Firebase user object with accessToken
   * @param {string} businessId - MrCall business ID
   * @param {Array} changes - Array of {variable_name, new_value}
   * @returns {Promise<Object>} {success, applied, errors}
   */
  applyChanges: function(user, businessId, changes, sessionId = null) {
    const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + user.accessToken
    };

    const body = { business_id: businessId, changes: changes };
    if (sessionId) body.session_id = sessionId;

    return axios.post(
      process.env.VUE_APP_ZYLCH_URL + "/api/mrcall/apply-changes",
      body,
      { headers: headers }
    ).then((response) => {
      return response.data;
    }).catch((error) => {
      console.error("Error applying changes:", error);
      throw error;
    });
  }
};
