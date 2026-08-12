<template>
  <Toast></Toast>
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em"/>
  <div v-if="user" class="contacts-container">
    <div class="contacts-header">
      <p class="title text-center mb-4 md:text-4xl text-3xl">{{ $t('components.contacts.title') }}</p>
    </div>

    <Toolbar class="mb-4">
      <template #start>
        <SelectButton
            v-model="activeProvider"
            :options="providerOptions"
            optionLabel="label"
            optionValue="value"
            multiple
            @change="onProviderChange()"
            class="mr-3"
        />
        <template v-if="activeProvider.includes('1business')">
          <Button
              :label="$t('components.contacts.addContact')"
              icon="pi pi-plus" iconPos="right"
              @click="openNewContactDialog()"
          />
          <Button
              :label="$t('components.contacts.bulkUpload')"
              icon="pi pi-upload" iconPos="right"
              class="ml-2"
              @click="openBulkUploadDialog()"
          />
          <Button
              :label="$t('components.contacts.deleteAll')"
              icon="pi pi-trash" iconPos="right"
              severity="danger"
              class="ml-2"
              @click="confirmDeleteAll()"
          />
        </template>
      </template>
      <template #end>
        <div class="search-container">
          <IconField>
            <InputText
                v-model="searchQuery"
                :placeholder="$t('components.contacts.searchPlaceholder')"
                class="w-full"
                v-on:keyup.enter="onSearch()"
            />
            <InputIcon class="pi pi-search" @click="onSearch()" style="cursor: pointer"/>
          </IconField>
        </div>
      </template>
    </Toolbar>

    <Paginator
        :template="{
          '640px': 'PrevPageLink CurrentPageReport NextPageLink',
          '960px': 'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
          default: 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown'
        }"
        :alwaysShow="false"
        :rows="size"
        v-model:first="first"
        :rowsPerPageOptions="[10, 20, 50, 100]"
        :totalRecords="totalHits"
        @page="onPage($event)"
    />

    <DataTable
        :value="contacts"
        stripedRows
        responsiveLayout="scroll"
    >
      <Column field="provider" :header="$t('components.contacts.provider')" sortable style="width: 3.5rem">
        <template #body="slotProps">
          <i v-if="slotProps.data.provider === '1business'" class="pi pi-building provider-icon" v-tooltip="$t('components.contacts.providerBusiness')"></i>
          <i v-else-if="slotProps.data.provider === '2hb'" class="pi pi-phone provider-icon" v-tooltip="$t('components.contacts.providerHb')"></i>
        </template>
      </Column>
      <Column field="displayName" :header="$t('components.contacts.form.displayName')" sortable>
        <template #body="slotProps">
          {{ slotProps.data.displayName || formatName(slotProps.data.name) }}
        </template>
      </Column>
      <Column field="name.nickname" :header="$t('components.contacts.form.nickname')" sortable class="hidden-mobile"/>
      <Column :header="$t('components.contacts.form.phone')" sortable :sortField="'phones[0].number'">
        <template #body="slotProps">
          <div v-for="(phone, idx) in (slotProps.data.phones || [])" :key="idx">
            {{ phone.number }}<span v-if="phone.type" class="phone-type"> ({{ phone.type }})</span>
          </div>
        </template>
      </Column>
      <Column :header="$t('components.contacts.form.email')" class="hidden-mobile">
        <template #body="slotProps">
          <div v-for="(email, idx) in (slotProps.data.emails || [])" :key="idx">
            {{ email.address }}
          </div>
        </template>
      </Column>
      <Column :header="$t('components.contacts.form.company')" sortable :sortField="'organizations[0].company'" class="hidden-mobile">
        <template #body="slotProps">
          <span v-if="slotProps.data.organizations && slotProps.data.organizations.length">
            {{ slotProps.data.organizations[0].company }}
          </span>
        </template>
      </Column>
      <Column :header="$t('components.contacts.actions')" style="width: 13rem">
        <template #body="slotProps">
          <template v-if="slotProps.data.provider !== '2hb'">
            <Button v-if="isContactBlocked(slotProps.data)"
                    icon="pi pi-plus-circle" severity="success" text rounded
                    v-tooltip="$t('components.contacts.unblockContact')"
                    @click="toggleBlockContact(slotProps.data)"/>
            <Button v-else
                    icon="pi pi-minus-circle" severity="danger" text rounded
                    v-tooltip="$t('components.contacts.blockContact')"
                    @click="toggleBlockContact(slotProps.data)"/>
          </template>
          <Button icon="pi pi-download" severity="success" text rounded
                  v-tooltip="$t('components.contacts.downloadVcard')"
                  @click="downloadContactCard(slotProps.data)"/>
          <Button v-if="slotProps.data.provider !== '2hb'" icon="pi pi-pencil" severity="info" text rounded
                  @click="openEditContactDialog(slotProps.data)"/>
          <Button icon="pi pi-trash" severity="danger" text rounded
                  @click="confirmDeleteContact(slotProps.data)"/>
        </template>
      </Column>
    </DataTable>

    <Paginator
        :template="{
          '640px': 'PrevPageLink CurrentPageReport NextPageLink',
          '960px': 'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
          default: 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown'
        }"
        :alwaysShow="false"
        :rows="size"
        v-model:first="first"
        :rowsPerPageOptions="[10, 20, 50, 100]"
        :totalRecords="totalHits"
        @page="onPage($event)"
    />

    <!-- Add / Edit Dialog -->
    <Dialog
        v-model:visible="contactDialogVisible"
        :header="importingContact ? $t('components.contacts.importContact') : (editingContact ? $t('components.contacts.editContact') : $t('components.contacts.addContact'))"
        :modal="true"
        :style="{ width: '600px' }"
        :closable="true"
    >
      <div class="dialog-content">
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.firstName') }}</label>
          <InputText v-model="contactForm.name.first" class="w-full"/>
        </div>
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.lastName') }}</label>
          <InputText v-model="contactForm.name.last" class="w-full"/>
        </div>
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.nickname') }}</label>
          <InputText v-model="contactForm.nickname" class="w-full"/>
        </div>
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.displayName') }}</label>
          <InputText v-model="contactForm.displayName" class="w-full"
                     :placeholder="displayNamePlaceholder"/>
        </div>

        <!-- Phones -->
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.phone') }}</label>
          <div v-for="(phone, idx) in contactForm.phones" :key="idx" class="flex align-items-center gap-2 mb-2">
            <InputText v-model="phone.number" :placeholder="$t('components.contacts.form.phonePlaceholder')" class="flex-grow-1"/>
            <Dropdown v-model="phone.type" :options="phoneTypes" optionLabel="label" optionValue="value"
                      :placeholder="$t('components.contacts.form.type')" style="width: 130px"/>
            <Button icon="pi pi-minus" severity="danger" text rounded size="small"
                    @click="removePhone(idx)" v-if="contactForm.phones.length > 1"/>
          </div>
          <Button :label="$t('components.contacts.form.addPhone')" icon="pi pi-plus" text size="small"
                  @click="addPhone()"/>
        </div>

        <!-- Emails -->
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.email') }}</label>
          <div v-for="(email, idx) in contactForm.emails" :key="idx" class="flex align-items-center gap-2 mb-2">
            <InputText v-model="email.address" :placeholder="$t('components.contacts.form.emailPlaceholder')" class="flex-grow-1"/>
            <Button icon="pi pi-minus" severity="danger" text rounded size="small"
                    @click="removeEmail(idx)" v-if="contactForm.emails.length > 1"/>
          </div>
          <Button :label="$t('components.contacts.form.addEmail')" icon="pi pi-plus" text size="small"
                  @click="addEmail()"/>
        </div>

        <!-- Company -->
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.company') }}</label>
          <InputText v-model="contactForm.company" class="w-full"/>
        </div>

        <!-- Notes -->
        <div class="field mb-3">
          <label class="font-bold block mb-2">{{ $t('components.contacts.form.notes') }}</label>
          <Textarea v-model="contactForm.notes" rows="3" class="w-full"/>
        </div>
      </div>

      <template #footer>
        <Button :label="$t('components.contacts.cancel')" icon="pi pi-times" text @click="contactDialogVisible = false"/>
        <Button :label="$t('components.contacts.save')" icon="pi pi-check" @click="saveContact()"/>
      </template>
    </Dialog>

    <!-- Bulk Upload Dialog -->
    <Dialog
        v-model:visible="bulkUploadDialogVisible"
        :header="$t('components.contacts.bulkUpload')"
        :modal="true"
        :style="{ width: '700px' }"
        :closable="true"
    >
      <div class="dialog-content">
        <p class="mb-3">{{ $t('components.contacts.bulkUploadDescription') }}</p>
        <Textarea v-model="bulkJsonText" rows="12" class="w-full font-monospace" :placeholder="bulkJsonPlaceholder"/>
      </div>
      <template #footer>
        <Button :label="$t('components.contacts.cancel')" icon="pi pi-times" text @click="bulkUploadDialogVisible = false"/>
        <Button :label="$t('components.contacts.bulkUploadSubmit')" icon="pi pi-upload" @click="submitBulkUpload()" :disabled="!bulkJsonText.trim()"/>
      </template>
    </Dialog>
  </div>
</template>

<script>
import {computed} from 'vue'
import {useStore} from 'vuex'
import {useToast} from 'primevue/usetoast'
import {useConfirm} from 'primevue/useconfirm'
import ContactApi from '@/utils/Contact'

export default {
  setup() {
    const store = useStore()
    const toast = useToast()
    const confirm = useConfirm()
    return {
      store,
      toast,
      confirm,
      user: computed(() => store.state.user)
    }
  },
  data() {
    return {
      businessId: null,
      loading: false,
      contacts: [],
      totalHits: 0,
      first: 0,
      size: 10,
      searchQuery: '',
      activeSearchCriteria: {},
      activeProvider: ['1business'],
      contactDialogVisible: false,
      editingContact: false,
      importingContact: false,
      contactForm: this.emptyContactForm(),
      bulkUploadDialogVisible: false,
      bulkJsonText: '',
      bulkJsonPlaceholder: '[\n  {\n    "displayName": "Mario Rossi",\n    "phones": [{ "number": "+391234567890" }],\n    "emails": [{ "address": "mario@example.com" }]\n  }\n]',
      phoneTypes: [
        {label: 'Mobile', value: 'mobile'},
        {label: 'Home', value: 'home'},
        {label: 'Work', value: 'work'},
        {label: 'Other', value: 'other'}
      ]
    }
  },
  computed: {
    providerOptions() {
      return [
        {label: this.$t('components.contacts.providerBusiness'), value: '1business'},
        {label: this.$t('components.contacts.providerHb'), value: '2hb'}
      ]
    },
    displayNamePlaceholder() {
      const first = this.contactForm.name.first || ''
      const last = this.contactForm.name.last || ''
      return (first + ' ' + last).trim() || ''
    }
  },
  methods: {
    emptyContactForm() {
      return {
        id: null,
        displayName: '',
        nickname: '',
        name: {first: '', last: ''},
        phones: [{number: '', type: 'mobile'}],
        emails: [{address: ''}],
        company: '',
        notes: ''
      }
    },
    isContactBlocked(contact) {
      if (!contact.notes || !contact.notes.length) return false
      return contact.notes[0].note && contact.notes[0].note.includes('#MRCALL#BLOCK#')
    },
    async toggleBlockContact(contact) {
      const blocked = this.isContactBlocked(contact)
      let notes = contact.notes && contact.notes.length
          ? JSON.parse(JSON.stringify(contact.notes))
          : [{note: ''}]

      if (blocked) {
        notes[0].note = notes[0].note.replace(/#MRCALL#BLOCK#/g, '').trim()
      } else {
        notes[0].note = (notes[0].note + ' #MRCALL#BLOCK#').trim()
      }

      const payload = {
        ...contact,
        notes: notes
      }

      this.loading = true
      try {
        await ContactApi.update(this.user, this.businessId, payload)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.contacts.toast.success'),
          detail: blocked
              ? this.$t('components.contacts.toast.contactUnblocked')
              : this.$t('components.contacts.toast.contactBlocked'),
          life: 3000
        })
        await this.fetchContacts()
      } catch (error) {
        console.error('Error toggling block:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.error'),
          detail: this.$t('components.contacts.toast.blockFailed'),
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    formatName(name) {
      if (!name) return ''
      return [name.first, name.last].filter(Boolean).join(' ')
    },
    addPhone() {
      this.contactForm.phones.push({number: '', type: 'mobile'})
    },
    removePhone(idx) {
      this.contactForm.phones.splice(idx, 1)
    },
    addEmail() {
      this.contactForm.emails.push({address: ''})
    },
    removeEmail(idx) {
      this.contactForm.emails.splice(idx, 1)
    },
    buildSearchCriteria() {
      const provider = (this.activeProvider.length === 1) ? this.activeProvider[0] : null
      const criteria = {
        ...this.activeSearchCriteria,
        provider: provider,
        limit: this.size,
        offset: this.first,
        orderBy: ['displayName'],
        sortOrder: 'ASC'
      }
      return criteria
    },
    onProviderChange() {
      if (!this.activeProvider || this.activeProvider.length === 0) {
        this.activeProvider = ['1business', '2hb']
      }
      this.first = 0
      this.fetchContacts()
    },
    onPage(event) {
      this.first = event.first
      this.size = event.rows
      this.fetchContacts()
    },
    onSearch() {
      const query = this.searchQuery.trim()
      if (!query) {
        this.activeSearchCriteria = {}
      } else if (query.startsWith('+') || /^\d+$/.test(query)) {
        this.activeSearchCriteria = {phones: [{number: query}]}
      } else if (query.includes('@')) {
        this.activeSearchCriteria = {emails: [{address: query}]}
      } else {
        this.activeSearchCriteria = {displayName: query}
      }
      this.first = 0
      this.fetchContacts()
    },
    async fetchContacts() {
      this.loading = true
      try {
        const result = await ContactApi.search(this.user, this.businessId, this.buildSearchCriteria())
        this.contacts = result.contacts
        this.totalHits = result.totalHits
      } catch (error) {
        console.error('Error loading contacts:', error)
        this.contacts = []
        this.totalHits = 0
      } finally {
        this.loading = false
      }
    },
    downloadContactCard(contact) {
      const name = contact.name || {}
      const displayName = contact.displayName || [name.first, name.last].filter(Boolean).join(' ') || 'contact'
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:' + (name.last || '') + ';' + (name.first || '') + ';;;',
        'FN:' + displayName
      ]
      if (name.nickname) {
        lines.push('NICKNAME:' + name.nickname)
      }
      if (contact.phones && contact.phones.length) {
        contact.phones.forEach(p => {
          const type = (p.type || 'cell').toUpperCase()
          lines.push('TEL;TYPE=' + type + ':' + p.number)
        })
      }
      if (contact.emails && contact.emails.length) {
        contact.emails.forEach(e => {
          lines.push('EMAIL:' + e.address)
        })
      }
      if (contact.organizations && contact.organizations.length && contact.organizations[0].company) {
        lines.push('ORG:' + contact.organizations[0].company)
      }
      if (contact.notes && contact.notes.length && contact.notes[0].note) {
        lines.push('NOTE:' + contact.notes[0].note)
      }
      lines.push('END:VCARD')

      const blob = new Blob([lines.join('\r\n')], {type: 'text/vcard;charset=utf-8'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = displayName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.vcf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    openNewContactDialog() {
      this.editingContact = false
      this.importingContact = false
      this.contactForm = this.emptyContactForm()
      this.contactDialogVisible = true
    },
    openImportContactDialog(contact) {
      this.editingContact = false
      this.importingContact = true
      this.contactForm = {
        id: null,
        displayName: contact.displayName || '',
        nickname: contact.name?.nickname || '',
        name: {
          first: contact.name?.first || '',
          last: contact.name?.last || ''
        },
        phones: contact.phones && contact.phones.length
            ? contact.phones.map(p => ({number: p.number || '', type: p.type || 'mobile'}))
            : [{number: '', type: 'mobile'}],
        emails: contact.emails && contact.emails.length
            ? contact.emails.map(e => ({address: e.address || ''}))
            : [{address: ''}],
        company: contact.organizations && contact.organizations.length
            ? contact.organizations[0].company || ''
            : '',
        notes: contact.notes && contact.notes.length
            ? contact.notes[0].note || ''
            : ''
      }
      this.contactDialogVisible = true
    },
    openEditContactDialog(contact) {
      this.editingContact = true
      this.importingContact = false
      this.contactForm = {
        id: contact.id,
        displayName: contact.displayName || '',
        nickname: contact.name?.nickname || '',
        name: {
          first: contact.name?.first || '',
          last: contact.name?.last || ''
        },
        phones: contact.phones && contact.phones.length
            ? contact.phones.map(p => ({number: p.number || '', type: p.type || 'mobile'}))
            : [{number: '', type: 'mobile'}],
        emails: contact.emails && contact.emails.length
            ? contact.emails.map(e => ({address: e.address || ''}))
            : [{address: ''}],
        company: contact.organizations && contact.organizations.length
            ? contact.organizations[0].company || ''
            : '',
        notes: contact.notes && contact.notes.length
            ? contact.notes[0].note || ''
            : ''
      }
      this.contactDialogVisible = true
    },
    buildContactPayload() {
      const form = this.contactForm
      const displayName = form.displayName || [form.name.first, form.name.last].filter(Boolean).join(' ')
      const payload = {
        displayName: displayName || null,
        name: {
          first: form.name.first || null,
          last: form.name.last || null,
          nickname: form.nickname.trim() || null
        },
        phones: form.phones.filter(p => p.number.trim()).map(p => ({
          number: p.number.trim(),
          type: p.type || null
        })),
        emails: form.emails.filter(e => e.address.trim()).map(e => ({
          address: e.address.trim()
        })),
        organizations: form.company.trim()
            ? [{company: form.company.trim()}]
            : [],
        notes: form.notes.trim()
            ? [{note: form.notes.trim()}]
            : []
      }
      if (form.id) {
        payload.id = form.id
      }
      return payload
    },
    async saveContact() {
      const payload = this.buildContactPayload()
      if (!payload.displayName && (!payload.phones || payload.phones.length === 0)) {
        this.toast.add({
          severity: 'warn',
          summary: this.$t('components.contacts.toast.validationError'),
          detail: this.$t('components.contacts.toast.nameOrPhoneRequired'),
          life: 3000
        })
        return
      }
      this.loading = true
      try {
        if (this.editingContact) {
          await ContactApi.update(this.user, this.businessId, payload)
          this.toast.add({
            severity: 'success',
            summary: this.$t('components.contacts.toast.success'),
            detail: this.$t('components.contacts.toast.contactUpdated'),
            life: 3000
          })
        } else {
          await ContactApi.create(this.user, this.businessId, payload)
          this.toast.add({
            severity: 'success',
            summary: this.$t('components.contacts.toast.success'),
            detail: this.importingContact
                ? this.$t('components.contacts.toast.contactImported')
                : this.$t('components.contacts.toast.contactCreated'),
            life: 3000
          })
        }
        this.contactDialogVisible = false
        await this.fetchContacts()
      } catch (error) {
        console.error('Error saving contact:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.error'),
          detail: this.$t('components.contacts.toast.saveFailed'),
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    confirmDeleteContact(contact) {
      const name = contact.displayName || this.formatName(contact.name) || contact.id
      this.confirm.require({
        message: this.$t('components.contacts.confirmDeleteMessage', {name: name}),
        header: this.$t('components.contacts.confirmDeleteTitle'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => this.deleteContact(contact),
        reject: () => {}
      })
    },
    async deleteContact(contact) {
      this.loading = true
      try {
        await ContactApi.delete(this.user, this.businessId, contact.id)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.contacts.toast.success'),
          detail: this.$t('components.contacts.toast.contactDeleted'),
          life: 3000
        })
        await this.fetchContacts()
      } catch (error) {
        console.error('Error deleting contact:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.error'),
          detail: this.$t('components.contacts.toast.deleteFailed'),
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    confirmDeleteAll() {
      this.confirm.require({
        message: this.$t('components.contacts.confirmDeleteAllMessage'),
        header: this.$t('components.contacts.confirmDeleteTitle'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => this.deleteAllContacts(),
        reject: () => {}
      })
    },
    async deleteAllContacts() {
      this.loading = true
      try {
        await ContactApi.deleteAll(this.user, this.businessId)
        this.contacts = []
        this.totalHits = 0
        this.first = 0
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.contacts.toast.success'),
          detail: this.$t('components.contacts.toast.allContactsDeleted'),
          life: 3000
        })
      } catch (error) {
        console.error('Error deleting all contacts:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.error'),
          detail: this.$t('components.contacts.toast.deleteFailed'),
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    openBulkUploadDialog() {
      this.bulkJsonText = ''
      this.bulkUploadDialogVisible = true
    },
    async submitBulkUpload() {
      let contacts
      try {
        contacts = JSON.parse(this.bulkJsonText)
      } catch (e) {
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.validationError'),
          detail: this.$t('components.contacts.toast.invalidJson'),
          life: 5000
        })
        return
      }
      if (!Array.isArray(contacts)) {
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.validationError'),
          detail: this.$t('components.contacts.toast.jsonMustBeArray'),
          life: 5000
        })
        return
      }
      this.loading = true
      try {
        await ContactApi.bulkResync(this.user, this.businessId, contacts)
        this.bulkUploadDialogVisible = false
        this.first = 0
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.contacts.toast.success'),
          detail: this.$t('components.contacts.toast.bulkUploadSuccess'),
          life: 3000
        })
        await this.fetchContacts()
      } catch (error) {
        console.error('Error bulk uploading contacts:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.contacts.toast.error'),
          detail: this.$t('components.contacts.toast.bulkUploadFailed'),
          life: 5000
        })
      } finally {
        this.loading = false
      }
    }
  },
  mounted() {
    this.businessId = this.$route.query.id
    if (this.businessId && this.user) {
      this.fetchContacts()
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.contacts-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.contacts-header {
  margin-bottom: 1rem;
}

.search-container {
  min-width: 250px;
}

.provider-icon {
  font-size: 1.2rem;
  color: @mrcall_blue;
}

.phone-type {
  color: @mrcall_dark_grey;
  font-size: 0.85em;
}

.field label {
  color: @mrcall_black;
}

.dialog-content {
  padding: 0.5rem 0;
}

.font-monospace {
  font-family: monospace;
  font-size: 0.85rem;
}

.p-button {
  margin-right: .5rem;
}

@media screen and (max-width: 640px) {
  .contacts-container {
    padding: 0.5rem;
  }

  .search-container {
    min-width: 100%;
    margin-top: 0.5rem;
  }

  .p-button {
    margin-bottom: .5rem;

    &:not(.p-button-icon-only) {
      display: flex;
      width: 100%;
    }
  }

  .hidden-mobile {
    display: none;
  }
}
</style>
