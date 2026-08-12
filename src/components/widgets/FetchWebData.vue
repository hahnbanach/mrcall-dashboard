<template>
  <div class="fetch-web-data">
    <div class="fetch-controls">
      <Button
        :disabled="showSpinner || !urls || urls.length === 0 || !prompt"
        :loading="showSpinner"
        :label="showSpinner ? 'Loading...' : 'Fetch Web Content'"
        @click="fetchWebContent()"
        class="p-button-text md:w-auto py-3 w-full"
      />
    </div>
    <div class="fetch-spinner" v-show="showSpinner">
      <ProgressSpinner
        style="width: 50px; height: 50px;"
        strokeWidth="4"
        :pt="{
          spinner: { style: { animationDuration: '2s' } },
          circle: { style: { stroke: '#0068FF', strokeWidth: 3, animation: 'auto' } }
        }"
        fill="transparent"
        animationDuration="2.5s"
        aria-label="Loading"
      />
    </div>
    <div class="fetch-result" v-if="!showSpinner">
      <Textarea
        v-model="result"
        class="w-full"
        rows="10"
        placeholder="Results will appear here..."
      />
    </div>
    <div class="fetch-error" v-if="errorMessage">
      <small class="p-error">{{ errorMessage }}</small>
    </div>
  </div>
</template>

<script>
import { computed, ref } from "vue";
import { useStore } from "vuex";
import router from "@/router";
import axios from "axios";

export default {
  name: "FetchWebData",
  props: {
    urls: {
      type: Array,
      required: true
    },
    prompt: {
      type: String,
      required: true
    },
    language: {
      type: String,
      default: "en-US"
    }
  },
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user);
    return {
      store,
      user,
      router
    };
  },
  data: function () {
    return {
      showSpinner: false,
      result: ref(""),
      errorMessage: ""
    };
  },
  methods: {
    fetchWebContent() {
      const self = this;
      self.result = "";
      self.errorMessage = "";

      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };

      const request = {
        "#language": this.language,
        "urls": this.urls,
        "prompt": this.prompt
      };

      console.log("FetchWebData request:", request);
      this.showSpinner = true;

      axios.post(
        process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/atom/fetch_web_content_simple",
        request,
        { headers: headers }
      ).then((response) => {
        console.debug("FetchWebData Response:", response);
        this.showSpinner = false;
        if (response.data) {
          self.result = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data, null, 2);
        }
      }).catch((error) => {
        this.showSpinner = false;
        console.error("FetchWebData Error:", error);
        if (error.response && error.response.status === 401) {
          this.store.dispatch('logout');
          router.replace('/login');
        } else {
          self.errorMessage = error.message || "An error occurred while fetching data";
        }
      });
    }
  }
};
</script>

<style scoped lang="less">
.fetch-web-data {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fetch-controls {
  display: flex;
  justify-content: flex-start;
}

.fetch-spinner {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.fetch-result {
  width: 100%;
}

.fetch-error {
  color: #dc3545;
}
</style>
