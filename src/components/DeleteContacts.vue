<template>
  <Toast></Toast>
  <div class="delete-account-button">
    <div class="p-d-flex p-jc-center">
      <div class="card">
        <div class="text-center">
          <p class="title mb-4 text-4xl" style="text-align: center ;">{{ $t('components.deletecontacts.deleteContactsTitle') }}</p>
          <Button @click="deleteContactsDialog()"
                  icon="pi pi-trash" :label="$t('components.deletecontacts.submitButtonLabel')" class="p-mt-2 md:w-auto py-3 px-6 w-full" />
        </div>
      </div>
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
    const router = useRouter()
    const store = useStore()
    const confirm = useConfirm()
    const toast = useToast()
    const business = computed(() => store.state.selectedBusiness)
    const { t } = useI18n()

    return {
      t,
      store,
      business,
      router,
      toast,
      confirm
    }
  },
  data() {
    return {
      password: '',
      error: null,
      user: computed(() => store.state.user),
      pageTexts: {
        it: {
          deleteContactsTitle: "Cancella i tuoi contatti da MrCall",
          submitButtonLabel: "Cancella",
          confirmationRequest: "I tuoi contatti, sia quelli sincronizzati dalla rubrica sia quelli " +
              "acquisiti tramite le chiamate verranno rimossi dai database di MrCall. " +
              "Dopo la cancellazione i tuoi contatti non saranno riconosciuti per nome come se " +
              "chiamassero la prima volta. " +
              "Confermi di voler procedere?",
          operationCompleted: "La cancellazione dei tuoi contatti è stata completata.",
          removeCompletedHeader: "Cancellazione",
          logoutAfterCancellationLabel: "Ok",
          confirmCancellation: "Conferma cancellazione",
          toastCancelContactsSummary: "Cancellazione contatti",
          toastCancellingOperationSummary: "Annulla operazione",
          toastErrorSummary: "Per favore segnala il problema all'assistenza tecnica il problema, " +
              "verificheremo che la cancellazione dei contatti sia completata correttamente.",
          toastNotifyFortcomingCancelOperation: "Stiamo cancellando i tuoi contatti come richiesto",
          toastNotifyCanceledCancelContactsOperation: "Cancellazione contatti annullata",
        }
      }
    }
  },
  created() {
  },
  mounted() {
  },
  methods: {
    deleteContacts() {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      console.log("Token: ", this.user.accessToken);
      axios.post(process.env.VUE_APP_STARCHAT_URL +
          "/mrcall/v1/mrcall0/crm/contact/delete/all?businessId=" + this.business.businessId,
          {},
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.debug("Removed contacts response:", response)
        this.confirm.require({
          message: this.t('components.deletecontacts.operationCompleted'),
          header: this.t('components.deletecontacts.removeCompletedHeader'),
          icon: 'pi pi-check-circle',
          acceptLabel: this.t('components.deletecontacts.logoutAfterCancellationLabel'),
          rejectClass: 'visibility-reject-button-off',
          defaultFocus: 'accept',
          accept: () => {
            router.replace('/businesses')
          }
        });
      }).catch((error) => {
        this.showProgressBar = false;
        this.toast.add({severity:'error', summary: this.t('components.deletecontacts.toastCancelContactsSummary'),
          detail: this.t('components.deletecontacts.toastErrorSummary') + ": " + error, life: 5000})
        if(error.response.status === 401) {
          console.error(error.response)
          store.dispatch('logout')
          router.replace('/')
        }
      })
    },
    deleteContactsDialog() {
      this.showProgressBar = true;
      this.confirm.require({
        message: this.t('components.deletecontacts.confirmationRequest'),
        header: this.t('components.deletecontacts.confirmCancellation'),
        icon: 'pi pi-exclamation-triangle',
        defaultFocus: 'reject',
        accept: () => {
          this.toast.add({severity:'warn', summary: this.t('components.deletecontacts.toastCancelContactsSummary'),
            detail: this.t('components.deletecontacts.toastNotifyFortcomingCancelOperation'), life: 5000});
          this.deleteContacts()
        },
        reject: () => {
          this.toast.add({severity:'info', summary: this.t('components.deletecontacts.toastCancellingOperationSummary'),
            detail: this.t('components.deletecontacts.toastNotifyCanceledCancelContactsOperation'), life: 5000});
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

#response-message-success-symbol {
  font-size: 3rem;
  color: @mrcall_blue ;
}

.delete-account-button {
  .card {
    width: auto;

    form {
      //margin-top: 2rem;
    }

    .p-field {
      margin-bottom: 1.5rem;
    }
  }
}
</style>