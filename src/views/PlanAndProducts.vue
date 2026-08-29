<template>
  <div></div>
</template>

<script>
import axios from "axios";
import {useStore} from "vuex";
import {computed} from "vue";
import router from "@/router";

export default {
  setup() {
    const store = useStore();
    const user = computed(() => store.state.user);
    const business = computed(() => store.state.selectedBusiness);
    return {
      store,
      user,
      business
    }
  },
  data() {
  },
  async created() {
    const businessId = router.currentRoute.value.query.id;
    await this.retrieveBusiness(businessId);
    router.push('/plan');
  },
  mounted() {
  },
  methods: {
    async retrieveBusiness(businessId) {
      this.showProgressBar = true;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      await axios.get(
          process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business?id=" + businessId,
          {
            headers: headers
          }
      ).then((response) => {
        console.debug("Get business: ", response)
        if(response.data) {
          const item = response.data.find(e => typeof e !== 'undefined');
          console.debug("Item: ", item);
          this.store.commit('setSelectedBusiness', item);
          console.debug("Business: ", this.business);
        } else {
          this.setMessage("error", this.pageTexts.it.issuesContactCustomerService)
          this.businessVerified = false
        }
        this.showProgressBar = false
      }).catch((error) => {
        console.error("Getting business: ", error)
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.replace('/signin')
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>