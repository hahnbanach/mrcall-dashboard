<template>
  <div class="test-read-web-data">
    <div class="container">
      <h1>Test Fetch Web Data</h1>

      <div class="form-section">
        <div class="input-group">
          <label for="urls">URLs (one per line)</label>
          <Textarea
            id="urls"
            v-model="urlsInput"
            class="w-full"
            rows="4"
            placeholder="https://example.com&#10;https://another-example.com"
          />
        </div>

        <div class="input-group">
          <label for="prompt">Prompt</label>
          <Textarea
            id="prompt"
            v-model="promptInput"
            class="w-full"
            rows="3"
            placeholder="Enter your prompt here..."
          />
        </div>

        <div class="input-group">
          <label for="language">Language</label>
          <InputText
            id="language"
            v-model="languageInput"
            class="w-full"
            placeholder="en-US"
          />
        </div>
      </div>

      <div class="component-section">
        <h2>Result (Simple)</h2>
        <FetchWebData
          :urls="parsedUrls"
          :prompt="promptInput"
          :language="languageInput"
        />
      </div>

      <div class="component-section">
        <h2>Result (Perplexity)</h2>
        <FetchWebDataPerplexity
          :urls="parsedUrls"
          :prompt="promptInput"
          :language="languageInput"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { useStore } from "vuex";
import FetchWebData from "@/components/widgets/FetchWebData.vue";
import FetchWebDataPerplexity from "@/components/widgets/FetchWebDataPerplexity.vue";

export default {
  name: "TestReadWebData",
  components: {
    FetchWebData,
    FetchWebDataPerplexity
  },
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user);
    return {
      store,
      user
    };
  },
  data: function () {
    return {
      urlsInput: "https://www.mrcall.ai/prezzi/",
      promptInput: "Extract the plans and pricing informations",
      languageInput: "en-US"
    };
  },
  computed: {
    parsedUrls() {
      if (!this.urlsInput) return [];
      return this.urlsInput
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    }
  }
};
</script>

<style scoped lang="less">
.test-read-web-data {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

h1 {
  margin-bottom: 1rem;
  color: #333;
}

h2 {
  margin-bottom: 1rem;
  color: #555;
  font-size: 1.25rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-weight: 600;
    color: #333;
  }
}

.component-section {
  padding: 1.5rem;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}
</style>
