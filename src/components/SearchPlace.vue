<template>
  <ProgressBar v-show="showProgressBar" mode="indeterminate" style="height: .3em"/>
  <div class="main-page-content-section">
  </div>
</template>

<script>
import axios from "axios";

export default {
  data: () => {
    return {
      showProgressBar: false,
      placeCandidates: []
    }
  },
  methods: {
    searchPlace(textQuery) {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      const searchRequest = {
        query: textQuery,
        language: "it-IT"
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/place/search"
      axios.post(url,
          searchRequest,
          {
            headers: headers
          }
      ).then((response) => {
        console.log("RES:", response.data)
        if (response.data) {
          this.placeCandidates = response.data
        } else {
          this.placeCandidates = []
        }
      }).catch((error) => {
        console.error(error)
      })
    }
  }
}
</script>

<style lang="less" scoped>

</style>