<template>
  <div class="main-page-content-section zylch-page">
    <div class="page-header">
      <h1>
        <i class="pi pi-comments"></i>
        {{ $t('views.zylch.title') }}
      </h1>
      <p class="page-description">{{ $t('views.zylch.description') }}</p>
    </div>

    <ZylchChat />
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import ZylchChat from '@/components/ZylchChat.vue';

export default {
  name: 'Zylch',
  components: {
    ZylchChat
  },
  setup() {
    const store = useStore();
    const user = computed(() => store.state.user);

    onMounted(() => {
      // Track page view
      if (window.$gtag) {
        window.$gtag.event('zylch_page_opened', {
          user_email: user.value?.email || 'unknown'
        });
      }
    });

    return {
      user
    };
  }
};
</script>

<style scoped>
.zylch-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.page-header h1 i {
  color: var(--primary-color);
  font-size: 2rem;
}

.page-description {
  color: var(--text-color-secondary);
  font-size: 1.1rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .zylch-page {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .page-description {
    font-size: 1rem;
  }
}
</style>
