<template>
  <ProgressBar v-show="showProgressBar" mode="indeterminate" style="height: .3em"/>
  <div class="main-page-content-section">
    <div v-for="template in templates" :key="template.name">
      <Card>
        <template #header>
          <img alt=" header" src="@/assets/images/cards/usercard.png" style="height: 3em">
        </template>
        <template #title>
          {{template.humanName}}
        </template>
        <template #subtitle>
          {{template.name}}
        </template>
        <template #content>
          {{template.description}}
        </template>
        <template #footer>
          <Button @click="selectPlan(template.name)" icon="pi pi-plus" label="Seleziona" />
        </template>
      </Card>
      <Divider layout="vertical" />
    </div>
  </div>
</template>

<script>
import {computed} from 'vue'
import { useStore } from 'vuex'
import axios from "axios"
import router from "@/router"
import {useI18n} from "vue-i18n";
import Tr from "@/i18n/translation"

export default {
  data: () => {
    const { t } = useI18n()
    const store = useStore()
    const langCode = computed(() => Tr.getLocale()) ;
    return {
      t,
      langCode,
      store,
      showProgressBar: false,
      user: computed(() => store.state.user),
      templates: []
    }
  },
  methods: {
    selectPlan(templateName) {
      console.debug("TemplateName:", templateName)
      this.store.commit('setCreateBusinessTemplate', templateName)
      router.push({
        name: "Business",
        params: {
        }
      })
    },
    templateList() {
      this.showProgressBar = true;
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      axios.get(process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/mrcall0/crm/template?language=${this.langCode}`, //FIXME: this is for CORS, use different configuration in production
          {
            headers: headers
          }
      ).then((response) => {
        if(response.data) {
          this.templates = response.data
        }
        this.showProgressBar = false
      }).catch((error) => {
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.push('/login')
        }
        console.error(error)
      })
    }
  },
  mounted () {
    this.store.commit('setSelectedBusiness', null)
    this.templateList()
  }
}
</script>
