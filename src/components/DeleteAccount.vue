<template>
  <Toast></Toast>
  <div class="delete-account-section">
    <p class="danger-warning">
      <i class="pi pi-exclamation-triangle"></i>
      {{ $t('components.deleteaccount.confirmationRequest') }}
    </p>
    <div class="text-center">
      <Button
        @click="deleteAccountDialog()"
        icon="pi pi-trash"
        :label="$t('components.deleteaccount.submitButtonLabel')"
        severity="danger"
        class="p-mt-2 md:w-auto py-3 px-6 w-full"
      />
    </div>
  </div>
</template>

<script>
import {useRouter} from 'vue-router'
import {useStore} from 'vuex'
import axios from "axios";
import router from "@/router";
import store from "@/store";
import {useConfirm} from "primevue/useconfirm";
import {computed} from "vue";
import {useToast} from "primevue/usetoast";
import { useI18n } from 'vue-i18n'

export default {
  setup() {
    const { t } = useI18n()
    const router = useRouter()
    const store = useStore()
    const confirm = useConfirm()
    const toast = useToast()

    return {
      t,
      store,
      router,
      toast,
      confirm
    }
  },
  data() {
    return {
      password: '',
      error: null,
      user: computed(() => store.state.user)
    }
  },
  created() {
  },
  mounted() {
  },
  methods: {
    deleteAccount() {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      console.log("Token: ", this.user.accessToken);
      axios.delete(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/account",
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.debug("Removed account response:", response)
        this.confirm.require({
          message: this.t('components.deleteaccount.operationCompleted'),
          header: this.t('components.deleteaccount.removeCompletedHeader'),
          icon: 'pi pi-check-circle',
          acceptLabel: this.t('components.deleteaccount.logoutAfterCancellationLabel'),
          rejectClass: 'visibility-reject-button-off',
          defaultFocus: 'accept',
          accept: () => {
            //this.store.dispatch('deleteFirebaseUser' )
            store.dispatch('logout')
            router.replace('/')
          }
        });
      }).catch((error) => {
        this.showProgressBar = false;
        this.toast.add({severity:'error', summary: this.t('components.deleteaccount.toastCancelSubscriptionSummary'),
          detail: this.t('components.deleteaccount.toastErrorSummary') + ": " + error, life: 5000})
        if(error.response.status === 401) {
          console.error(error.response)
          store.dispatch('logout')
          router.replace('/')
        }
      })
    },
    deleteAccountDialog() {
      this.showProgressBar = true;
      this.confirm.require({
        message: this.t('components.deleteaccount.confirmationRequest'),
        header: this.t('components.deleteaccount.confirmCancellation'),
        icon: 'pi pi-exclamation-triangle',
        defaultFocus: 'reject',
        accept: () => {
          this.toast.add({severity:'warn', summary: this.t('components.deleteaccount.toastCancelSubscriptionSummary'),
            detail: this.t('components.deleteaccount.toastNotifyFortcomingCancelOperation'), life: 5000});
          this.deleteAccount()
        },
        reject: () => {
          this.toast.add({severity:'info', summary: this.t('components.deleteaccount.toastCancellingOperationSummary'),
            detail: this.t('components.deleteaccount.toastNotifyCanceledCancelAccountOperation'), life: 5000});
        }
      });
      this.showProgressBar = false;
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.delete-account-section {
  .danger-warning {
    color: @mrcall_status_error;
    font-size: 0.875rem;
    line-height: 1.5;
    margin-bottom: 1rem;
    text-align: center;

    .pi {
      margin-right: 0.5rem;
    }
  }
}
</style>
