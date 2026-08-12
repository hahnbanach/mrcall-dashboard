<template>
  <div class="plan-section main-page-content-section">
    <h1 class="plan-heading">{{ $t('components.businesses.planSubscription') }}</h1>
    <div class="content">
      <Subscription></Subscription>
      <Products></Products>
    </div>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>
  
<script>
import {computed} from 'vue'
import {useStore} from 'vuex'
import Subscription from "@/components/Subscription";
import Products from "@/components/Products";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import businessUtils from "@/utils/Business";
import router from "@/router";

export default {
  components: {Subscription, Products, PreFooterRequireAssistance},
  setup() {
    const store = useStore()
    return { store }
  },
  data() {
    const store = useStore()
    return {
      user: computed(() => store.state.user),
      loading: false
    }
  },
  created() {
  },
  mounted() {
    window.scrollTo(0, 0);
    const businessId = this.$route.query?.id
    if (businessId) {
      this.loading = true
      businessUtils.getBusiness(this.store, this.user, businessId)
        .then(business => {
          if (business) {
            this.store.commit('setSelectedBusiness', business)
          }
          this.loading = false
        })
        .catch(error => {
          console.error('Failed to load business:', error)
          this.loading = false
          if (error.response?.status === 401) {
            this.store.dispatch('logout')
            router.push('/login')
          }
        })
    }
  },
  methods: {
  }
}
</script>
  
<style lang="less" scoped>
@import '../assets/style/colors';

.plan-heading {
  font-size: 1.75rem;
  font-weight: 700;
  color: @mrcall_blue;
  margin-bottom: 1.5rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 100%;
  margin: auto;

  @media (min-width: 768px) {
    max-width: 60%;
  }
}

#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>