<template>
  <div style="width: 100%; height: 100%">
    <Toast />
    <ProgressBar
      mode="indeterminate"
      :style="{ height: '0.3em', visibility: showProgressBar ? 'visible' : 'hidden' }"
    />
    <div v-if="user">
      <!-- View Switcher -->
      <div v-if="queryConvResultReady" class="conversation-table-container">
        <div class="view-switcher">
          <SelectButton
            v-model="activeView"
            :options="viewOptions"
            optionLabel="label"
            optionValue="value"
            :allowEmpty="false"
          >
            <template #option="slotProps">
              <div class="view-option">
                <i :class="slotProps.option.icon"></i>
                <span>{{ slotProps.option.label }}</span>
                <span
                  v-if="slotProps.option.value === 'inbox' && unreadCount > 0"
                  class="unread-badge"
                >
                  {{ unreadCount }}
                </span>
              </div>
            </template>
          </SelectButton>
        </div>
      </div>

      <!-- Filters Section - Always visible when queryConvResultReady -->
      <div v-if="queryConvResultReady" class="conversation-table-container">
        <div class="filters-card">
          <div class="filters-header">
            <span class="filters-title">{{
              $t("components.conversations.filterTitle")
            }}</span>
          </div>

          <div class="filters-content">
            <!-- Date Range Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-calendar"></i>
                {{ $t("components.conversations.dateRangeLabel") }}
              </label>
              <div class="filter-control">
                <Calendar
                  style="flex: 1"
                  selectionMode="range"
                  v-model="rangeValue"
                  :manualInput="true"
                  :touchUI="true"
                  :showIcon="true"
                  :showButtonBar="true"
                  :showTime="true"
                  :showSeconds="true"
                  :placeholder="
                    $t('components.conversations.dateRangePlaceholder')
                  "
                />
                <button
                  v-if="rangeValue && rangeValue[0]"
                  type="button"
                  class="clear-btn"
                  @click="clearDateFilter"
                >
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>

            <!-- View Mode Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-eye"></i>
                {{ $t("components.conversations.viewModeLabel") }}
              </label>
              <div class="toggle-control">
                <ToggleSwitch v-model="messagesExpanded" />
                <span class="toggle-label">
                  {{
                    messagesExpanded
                      ? $t("components.conversations.expandedView")
                      : $t("components.conversations.collapsedView")
                  }}
                </span>
              </div>
            </div>

            <!-- Hide Read Toggle Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-list-check"></i>
                {{ $t("components.conversations.hideReadLabel") }}
              </label>
              <div class="toggle-control">
                <ToggleSwitch v-model="hideRead" />
                <span class="toggle-label">
                  {{
                    hideRead
                      ? $t("components.conversations.hideReadOn")
                      : $t("components.conversations.hideReadOff")
                  }}
                </span>
              </div>
            </div>

            <!-- Export Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-download"></i>
                {{ $t("components.conversations.exportLabel") }}
              </label>
              <div class="export-buttons">
                <Button
                  label="TSV"
                  icon="pi pi-file"
                  size="small"
                  outlined
                  @click="downloadItemsTsv()"
                />
                <Button
                  label="JSON"
                  icon="pi pi-file"
                  size="small"
                  outlined
                  @click="downloadItemsJson()"
                />
              </div>
            </div>

            <!-- Bulk Actions Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-list-check"></i>
                {{ $t("components.conversations.bulkActionsLabel") }}
              </label>
              <div class="export-buttons">
                <Button
                  v-if="activeView === 'inbox'"
                  :label="$t('components.conversations.actions.archiveAll')"
                  icon="pi pi-box"
                  size="small"
                  outlined
                  :disabled="totalHits === 0"
                  @click="bulkArchiveAll()"
                />
                <Button
                  v-if="activeView === 'inbox' || activeView === 'archive'"
                  :label="$t('components.conversations.actions.deleteAll')"
                  icon="pi pi-trash"
                  size="small"
                  class="btn-delete-all"
                  :disabled="totalHits === 0"
                  @click="bulkDeleteAll()"
                />
                <Button
                  v-if="activeView === 'archive'"
                  :label="$t('components.conversations.actions.moveAllToInbox')"
                  icon="pi pi-inbox"
                  size="small"
                  outlined
                  :disabled="totalHits === 0"
                  @click="bulkUnarchiveAll()"
                />
                <Button
                  v-if="activeView === 'trash'"
                  :label="$t('components.conversations.actions.restoreAll')"
                  icon="pi pi-undo"
                  size="small"
                  outlined
                  :disabled="totalHits === 0"
                  @click="bulkRestoreAll()"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results section - only when there are results -->
      <div v-if="totalHits > 0 && queryConvResultReady">
        <div class="conversation-table-container">
          <Paginator
            :template="{
              '640px': 'PrevPageLink CurrentPageReport NextPageLink',
              '960px':
                'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
              '1300px':
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink',
              default:
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageDropdown RowsPerPageDropdown',
            }"
            :alwaysShow="true"
            :rows="size"
            v-model:first="first"
            :rowsPerPageOptions="[10, 20, 30, 50, 100]"
            :totalRecords="totalHits"
            @page="onPage($event)"
          />
        </div>

        <!-- Conversation Cards -->
        <div id="results" class="conversation-table-container">
          <div class="conversations-list">
            <div
              v-for="[key, conversation] in filteredItems"
              :key="key"
              class="conversation-card"
              :class="{
                'unread': !isRead(conversation),
                'animating-out': animatingOut.has(key)
              }"
            >
              <div class="card-header">
                <div class="contact-info">
                  <span class="contact-name">
                    <span v-if="!isRead(conversation)" class="unread-dot"></span>
                    {{
                      conversation.contactName ||
                      $t("components.conversations.unknownContact")
                    }}
                  </span>
                  <span
                    v-if="conversation.contactNumber"
                    class="contact-number"
                  >
                    {{ conversation.contactNumber }}
                  </span>
                </div>
                <div class="timestamp-section">
                  <span
                    class="timestamp"
                    :class="{ 'timestamp-unread': !isRead(conversation) }"
                    :title="timestampToDate(conversation.startTimestamp)"
                  >
                    {{ getRelativeTime(conversation.startTimestamp) }}
                  </span>
                </div>

                <!-- Read/Unread toggle (always visible) -->
                <button
                  type="button"
                  class="action-btn action-btn-read"
                  :title="isRead(conversation)
                    ? $t('components.conversations.actions.markAsUnread')
                    : $t('components.conversations.actions.markAsRead')"
                  :disabled="actionInProgress.has(key)"
                  @click.stop="toggleReadStatus(key, conversation)"
                >
                  <i :class="isRead(conversation) ? 'pi pi-check-square' : 'pi pi-check'"></i>
                </button>

                <!-- Desktop Actions (hover reveal) -->
                <div class="desktop-actions">
                  <template v-if="activeView === 'inbox'">
                    <button
                      type="button"
                      class="action-btn"
                      :title="$t('components.conversations.actions.archive')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="archiveConversation(key, conversation)"
                    >
                      <i class="pi pi-box"></i>
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn-danger"
                      :title="$t('components.conversations.actions.delete')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="deleteConversation(key, conversation)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </template>
                  <template v-else-if="activeView === 'archive'">
                    <button
                      type="button"
                      class="action-btn"
                      :title="$t('components.conversations.actions.unarchive')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="unarchiveConversation(key, conversation)"
                    >
                      <i class="pi pi-inbox"></i>
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn-danger"
                      :title="$t('components.conversations.actions.delete')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="deleteConversation(key, conversation)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </template>
                  <template v-else-if="activeView === 'trash'">
                    <button
                      type="button"
                      class="action-btn"
                      :title="$t('components.conversations.actions.restore')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="restoreConversation(key, conversation)"
                    >
                      <i class="pi pi-undo"></i>
                    </button>
                  </template>
                </div>

                <!-- Mobile Actions (3-dot menu) -->
                <div class="mobile-action-trigger">
                  <button
                    type="button"
                    class="action-btn"
                    :disabled="actionInProgress.has(key)"
                    @click.stop="openMobileMenu($event, key, conversation)"
                  >
                    <i class="pi pi-ellipsis-v"></i>
                  </button>
                </div>
              </div>

              <div
                v-if="
                  conversation.data &&
                  conversation.data.conversation_transcription &&
                  conversation.data.conversation_transcription.length > 0
                "
                class="card-body"
              >
                <div
                  class="message-preview"
                  :class="{ 'message-collapsed': !(expandedCards[key] !== undefined ? expandedCards[key] : messagesExpanded) }"
                >
                  <div
                    v-for="(msg, idx) in conversation.data
                      .conversation_transcription"
                    :key="idx"
                    class="transcript-message"
                    :class="
                      msg.speaker_type === 'agent'
                        ? 'transcript-agent'
                        : 'transcript-user'
                    "
                  >
                    <span class="transcript-alias">{{ msg.alias }}</span>
                    <span class="transcript-content">{{ msg.content }}</span>
                  </div>
                </div>
                <button
                  v-if="conversation.data.conversation_transcription.length > 2"
                  type="button"
                  class="expand-btn"
                  @click="toggleCardExpanded(key)"
                >
                  {{
                    (expandedCards[key] !== undefined ? expandedCards[key] : messagesExpanded)
                      ? $t("components.conversations.showLess")
                      : $t("components.conversations.showMore")
                  }}
                </button>
              </div>

              <div v-if="conversation.audio" class="card-audio">
                <audio controls style="width: 100%">
                  <source
                    :src="'data:audio/mpeg;base64,' + conversation.audio"
                  />
                  {{ $t("components.conversations.table.audioNotSupported") }}
                </audio>
              </div>
            </div>
          </div>
        </div>

        <div class="conversation-table-container">
          <Paginator
            :template="{
              '640px': 'PrevPageLink CurrentPageReport NextPageLink',
              '960px':
                'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
              '1300px':
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink',
              default:
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageDropdown RowsPerPageDropdown',
            }"
            :alwaysShow="true"
            :rows="size"
            v-model:first="first"
            :rowsPerPageOptions="[10, 20, 30, 50, 100]"
            :totalRecords="totalHits"
            @page="onPage($event)"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="showProgressBar && !queryConvResultReady"
        class="conversation-table-container"
      >
        <div class="loading-skeleton">
          <div v-for="n in 3" :key="n" class="skeleton-card">
            <div class="skeleton-header">
              <div class="skeleton-text">
                <div class="skeleton-line skeleton-name"></div>
                <div class="skeleton-line skeleton-number"></div>
              </div>
            </div>
            <div class="skeleton-body">
              <div class="skeleton-line"></div>
              <div class="skeleton-line skeleton-short"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State - view-aware -->
      <div
        v-if="queryConvResultReady && totalHits === 0"
        class="conversation-table-container"
      >
        <div class="empty-state">
          <i :class="emptyStateIcon" class="empty-icon"></i>
          <p class="title">{{ emptyStateTitle }}</p>
          <p class="empty-description">{{ emptyStateDescription }}</p>
        </div>
      </div>
    </div>

    <!-- Mobile TieredMenu -->
    <TieredMenu ref="mobileMenu" :model="mobileMenuItems" popup />
  </div>
</template>

<script>
import { computed } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import axios from "axios";
import router from "@/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/config";
import { interval } from "rxjs";
import Tr from "@/i18n/translation";
import ConversationApi from "@/utils/Conversation";

export default {
  components: {},
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();
    return {
      store,
      toast,
      confirm,
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
      isWebView: computed(() => store.state.isWebview),
    };
  },
  data() {
    const locale = Tr.getLocale();
    return {
      locale,
      periodicEvent: null,
      rangeValue: null,
      businessId: null,
      timestampGte: null,
      timestampLte: null,
      router,
      langCode: locale,
      items: new Map(),
      totalHits: 0,
      size: 10,
      first: 0,
      showProgressBar: false,
      isAdmin: router.currentRoute.value.query.admin,
      queryConvResultReady: false,
      messagesExpanded: true,
      expandedCards: {},
      activeView: "inbox",
      unreadCount: 0,
      animatingOut: new Set(),
      actionInProgress: new Set(),
      mobileMenuItems: [],
      hideRead: false,
      newestTimestamp: null,
    };
  },
  computed: {
    filteredItems() {
      if (!this.hideRead) return this.items;
      const filtered = new Map();
      this.items.forEach((conv, key) => {
        if (!this.isRead(conv)) {
          filtered.set(key, conv);
        }
      });
      return filtered;
    },
    viewOptions() {
      return [
        {
          label: this.$t("components.conversations.views.inbox"),
          value: "inbox",
          icon: "pi pi-inbox",
        },
        {
          label: this.$t("components.conversations.views.archive"),
          value: "archive",
          icon: "pi pi-box",
        },
        {
          label: this.$t("components.conversations.views.trash"),
          value: "trash",
          icon: "pi pi-trash",
        },
      ];
    },
    emptyStateIcon() {
      if (this.activeView === "archive") return "pi pi-box";
      if (this.activeView === "trash") return "pi pi-trash";
      return "pi pi-inbox";
    },
    emptyStateTitle() {
      if (this.activeView === "archive")
        return this.$t("components.conversations.emptyStates.archiveEmpty");
      if (this.activeView === "trash")
        return this.$t("components.conversations.emptyStates.trashEmpty");
      return this.$t("components.conversations.emptyStates.inboxEmpty");
    },
    emptyStateDescription() {
      if (this.activeView === "archive")
        return this.$t(
          "components.conversations.emptyStates.archiveEmptyDescription"
        );
      if (this.activeView === "trash")
        return this.$t(
          "components.conversations.emptyStates.trashEmptyDescription"
        );
      return this.$t(
        "components.conversations.emptyStates.inboxEmptyDescription"
      );
    },
  },
  methods: {
    isRead(conversation) {
      if (!conversation.properties) return false;
      // Handle array format from API: [{ name, value, type }]
      if (Array.isArray(conversation.properties)) {
        const prop = conversation.properties.find(p => p.name === "MARKASREAD");
        return prop ? prop.value === "true" : false;
      }
      // Handle object format from local state update
      const prop = conversation.properties.MARKASREAD;
      if (!prop) return false;
      return prop === "true" || prop === true;
    },
    getRelativeTime(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);

      if (minutes < 1) {
        return this.$t("components.conversations.justNow");
      }
      if (minutes < 60) {
        return this.$t("components.conversations.minutesAgo", {
          count: minutes,
        });
      }
      const date = new Date(timestamp);
      return date.toLocaleString(this.langCode);
    },
    getCallDuration(conversation) {
      let durationMs = null;

      if (conversation.duration) {
        durationMs = conversation.duration;
      } else if (conversation.durationSeconds) {
        durationMs = conversation.durationSeconds * 1000;
      } else if (conversation.endTimestamp && conversation.startTimestamp) {
        durationMs = conversation.endTimestamp - conversation.startTimestamp;
      } else if (conversation.end_timestamp && conversation.start_timestamp) {
        durationMs = conversation.end_timestamp - conversation.start_timestamp;
      }

      if (!durationMs || durationMs <= 0) return null;

      const totalSeconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return this.$t("components.conversations.duration", { minutes, seconds });
    },
    isCardExpanded(key) {
      if (this.expandedCards[key] !== undefined) {
        return this.expandedCards[key];
      }
      return this.messagesExpanded;
    },
    toggleCardExpanded(key) {
      this.expandedCards[key] = !this.isCardExpanded(key);
    },
    clearDateFilter() {
      this.rangeValue = null;
    },
    dateToTimestamp(d) {
      return Date.parse(d);
    },
    timestampToDate(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString(this.langCode);
    },
    getViewFilters() {
      if (this.activeView === "archive") {
        return { archived: true, deleted: false };
      }
      if (this.activeView === "trash") {
        return { deleted: true };
      }
      // inbox
      return { archived: false, deleted: false };
    },
    downloadItemsTsv() {
      if (!this.user || !this.user.accessToken) return;
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      const request = {
        businessId: this.businessId,
        lightweight: true,
        ...this.getViewFilters(),
      };
      if (this.timestampGte != null) request.timestampGte = this.timestampGte;
      if (this.timestampLte != null) request.timestampLte = this.timestampLte;
      console.debug(request);
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/stream/tsv/formatTsvV1",
          request,
          {
            headers: headers,
            responseType: "blob",
          }
        )
        .then((response) => {
          const blob = new Blob([response.data], { type: response.data.type });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `conversations.${Date.now()}.tsv`;
          link.click();
          URL.revokeObjectURL(link.href);
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.error(error);
          self.showProgressBar = false;
        });
    },
    downloadItemsJson() {
      if (!this.user || !this.user.accessToken) return;
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      const request = {
        businessId: this.businessId,
        lightweight: true,
        ...this.getViewFilters(),
      };
      if (this.timestampGte != null) request.timestampGte = this.timestampGte;
      if (this.timestampLte != null) request.timestampLte = this.timestampLte;
      console.debug(request);
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/stream/json/jsonV1",
          request,
          {
            headers: headers,
            responseType: "blob",
          }
        )
        .then((response) => {
          const blob = new Blob([response.data], { type: response.data.type });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `conversations.${Date.now()}.stream.json`;
          link.click();
          URL.revokeObjectURL(link.href);
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.error(error);
          self.showProgressBar = false;
        });
    },
    async conversationList() {
      if (!this.user || !this.user.accessToken) {
        console.debug("User not ready, skipping conversationList");
        return;
      }
      if (this.animatingOut.size > 0) return;
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      const request = {
        businessId: self.businessId,
        lightweight: false,
        from: self.first,
        size: self.size,
        ...self.getViewFilters(),
      };
      if (self.timestampGte != null) request.timestampGte = self.timestampGte;
      if (self.timestampLte != null) request.timestampLte = self.timestampLte;
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/search?enableDataMap=true",
          request,
          {
            headers: headers,
          }
        )
        .then((response) => {
          self.queryConvResultReady = true;
          const map = new Map();
          let unread = 0;
          let newest = null;
          if (
            response.data &&
            response.data.hits &&
            response.data.hits.length > 0
          ) {
            response.data.hits.forEach(function (item) {
              map.set(item.document.id, item.document);
              if (!self.isRead(item.document)) {
                unread++;
              }
              if (item.document.startTimestamp && (newest === null || item.document.startTimestamp > newest)) {
                newest = item.document.startTimestamp;
              }
            });
            self.totalHits = response.data.totalHits;
            console.debug("totalHits:", response.data.totalHits);
          } else {
            self.totalHits = 0;
            self.newestTimestamp = null;
            self.showProgressBar = false;
          }
          self.items = map;
          self.newestTimestamp = newest;
          if (self.activeView === "inbox") {
            self.unreadCount = unread;
          }
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.error(error);
          self.queryConvResultReady = true;
          self.showProgressBar = false;
          if (error.response && error.response.status === 401) {
            self.store.dispatch("logout");
            router.replace("/login");
          }
        });
    },
    pollForNewConversations() {
      if (this.first !== 0) return;
      if (!this.user || !this.user.accessToken) return;
      if (this.animatingOut.size > 0) return;
      if (this.newestTimestamp === null) {
        this.conversationList();
        return;
      }
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      const request = {
        businessId: self.businessId,
        lightweight: false,
        from: 0,
        size: self.size,
        timestampGte: self.newestTimestamp + 1,
        ...self.getViewFilters(),
      };
      if (self.timestampLte != null) request.timestampLte = self.timestampLte;
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/search?enableDataMap=true",
          request,
          { headers: headers }
        )
        .then((response) => {
          if (
            response.data &&
            response.data.hits &&
            response.data.hits.length > 0
          ) {
            const newMap = new Map();
            let newest = self.newestTimestamp;
            response.data.hits.forEach(function (item) {
              newMap.set(item.document.id, item.document);
              if (item.document.startTimestamp && item.document.startTimestamp > newest) {
                newest = item.document.startTimestamp;
              }
            });
            // Prepend new items before existing ones
            self.items.forEach((val, key) => {
              if (!newMap.has(key)) {
                newMap.set(key, val);
              }
            });
            self.items = newMap;
            self.newestTimestamp = newest;
            self.totalHits = self.totalHits + response.data.hits.length;
            // Recalculate unread count
            if (self.activeView === "inbox") {
              let unread = 0;
              self.items.forEach((conv) => {
                if (!self.isRead(conv)) unread++;
              });
              self.unreadCount = unread;
            }
          }
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.debug("Poll error:", error);
          self.showProgressBar = false;
          if (error.response && error.response.status === 401) {
            self.store.dispatch("logout");
            router.replace("/login");
          }
        });
    },
    onPage(event) {
      this.first = event.first;
      this.size = event.rows;
      this.conversationList();
    },
    animateOutAndRemove(key) {
      return new Promise((resolve) => {
        this.animatingOut.add(key);
        this.animatingOut = new Set(this.animatingOut);
        setTimeout(() => {
          this.items.delete(key);
          this.items = new Map(this.items);
          this.totalHits = Math.max(0, this.totalHits - 1);
          this.animatingOut.delete(key);
          this.animatingOut = new Set(this.animatingOut);
          resolve();
        }, 300);
      });
    },
    async archiveConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.archive(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "success",
          summary: this.$t("components.conversations.toast.conversationArchived"),
          detail: this.$t("components.conversations.toast.undo"),
          life: 5000,
          group: "undo",
          data: { action: "unarchive", id: key },
        });
      } catch (error) {
        console.error("Archive failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async unarchiveConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.unarchive(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "success",
          summary: this.$t("components.conversations.toast.conversationUnarchived"),
          life: 5000,
        });
      } catch (error) {
        console.error("Unarchive failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async deleteConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.softDelete(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "warn",
          summary: this.$t("components.conversations.toast.conversationDeleted"),
          detail: this.$t("components.conversations.toast.undo"),
          life: 5000,
          group: "undo",
          data: { action: "undelete", id: key },
        });
      } catch (error) {
        console.error("Delete failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async restoreConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.undelete(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "success",
          summary: this.$t("components.conversations.toast.conversationRestored"),
          life: 5000,
        });
      } catch (error) {
        console.error("Restore failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async toggleReadStatus(key, conversation) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      const wasRead = this.isRead(conversation);
      try {
        if (wasRead) {
          await ConversationApi.markAsUnread(this.user, key);
        } else {
          await ConversationApi.markAsRead(this.user, key);
        }
        // Update local state
        const newValue = wasRead ? "false" : "true";
        if (!conversation.properties) {
          conversation.properties = {};
        }
        if (Array.isArray(conversation.properties)) {
          const idx = conversation.properties.findIndex(p => p.name === "MARKASREAD");
          if (idx >= 0) {
            conversation.properties[idx].value = newValue;
          } else {
            conversation.properties.push({ name: "MARKASREAD", value: newValue, type: "boolean" });
          }
        } else {
          conversation.properties.MARKASREAD = newValue;
        }
        // Recalculate unread count
        let unread = 0;
        this.items.forEach((conv) => {
          if (!this.isRead(conv)) unread++;
        });
        this.unreadCount = unread;
        // Force reactivity
        this.items = new Map(this.items);
      } catch (error) {
        console.error("Toggle read failed:", key, error.response ? error.response.status : "");
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    openMobileMenu(event, key, conversation) {
      const items = [];
      if (this.activeView === "inbox") {
        items.push({
          label: this.isRead(conversation)
            ? this.$t("components.conversations.actions.markAsUnread")
            : this.$t("components.conversations.actions.markAsRead"),
          icon: this.isRead(conversation) ? "pi pi-check-square" : "pi pi-check",
          command: () => this.toggleReadStatus(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.archive"),
          icon: "pi pi-box",
          command: () => this.archiveConversation(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.delete"),
          icon: "pi pi-trash",
          command: () => this.deleteConversation(key, conversation),
        });
      } else if (this.activeView === "archive") {
        items.push({
          label: this.isRead(conversation)
            ? this.$t("components.conversations.actions.markAsUnread")
            : this.$t("components.conversations.actions.markAsRead"),
          icon: this.isRead(conversation) ? "pi pi-check-square" : "pi pi-check",
          command: () => this.toggleReadStatus(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.unarchive"),
          icon: "pi pi-inbox",
          command: () => this.unarchiveConversation(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.delete"),
          icon: "pi pi-trash",
          command: () => this.deleteConversation(key, conversation),
        });
      } else if (this.activeView === "trash") {
        items.push({
          label: this.isRead(conversation)
            ? this.$t("components.conversations.actions.markAsUnread")
            : this.$t("components.conversations.actions.markAsRead"),
          icon: this.isRead(conversation) ? "pi pi-check-square" : "pi pi-check",
          command: () => this.toggleReadStatus(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.restore"),
          icon: "pi pi-undo",
          command: () => this.restoreConversation(key, conversation),
        });
      }
      this.mobileMenuItems = items;
      this.$nextTick(() => {
        this.$refs.mobileMenu.toggle(event);
      });
    },
    buildSearchFilter() {
      const filter = {
        businessId: this.businessId,
        ...this.getViewFilters(),
      };
      if (this.timestampGte != null) filter.timestampGte = this.timestampGte;
      if (this.timestampLte != null) filter.timestampLte = this.timestampLte;
      return filter;
    },
    bulkArchiveAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.archiveMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkArchive(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "success",
              summary: this.$t("components.conversations.toast.bulkArchived"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk archive failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
    bulkDeleteAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.deleteMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkDelete(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "warn",
              summary: this.$t("components.conversations.toast.bulkDeleted"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk delete failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
    bulkUnarchiveAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.unarchiveMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkUnarchive(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "success",
              summary: this.$t("components.conversations.toast.bulkUnarchived"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk unarchive failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
    bulkRestoreAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.restoreMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkUndelete(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "success",
              summary: this.$t("components.conversations.toast.bulkRestored"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk restore failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
  },
  watch: {
    activeView() {
      this.first = 0;
      this.items = new Map();
      this.totalHits = 0;
      this.expandedCards = {};
      this.newestTimestamp = null;
      this.conversationList();
    },
    rangeValue: function (value) {
      if (!this.user || !this.user.accessToken) return;
      this.first = 0;
      if (value === null) {
        this.timestampLte = null;
        this.timestampGte = null;
        this.conversationList();
      } else if (value[0] !== null && value[1] !== null) {
        console.debug("value[0] !== null and value[1] !== null", value);
        this.timestampGte = this.dateToTimestamp(value[0]);
        this.timestampLte = this.dateToTimestamp(value[1]);
        this.conversationList();
      } else if (value[0] !== null) {
        console.debug("value[0] !== null", value);
        this.timestampGte = this.dateToTimestamp(value[0]);
        this.conversationList();
      } else {
        console.error("null", value);
      }
    },
  },
  beforeUnmount() {
    console.debug("Before Unmount");
    if (this.periodicEvent) {
      this.periodicEvent.unsubscribe();
    }
  },
  mounted() {
    this.businessId = this.$route.query.id;
    if (this.$route.query.lang) {
      this.langCode = this.$route.query.lang.replace("_", "-");
    }
    if (!this.store || !this.store.state) {
      console.debug("Store not ready");
      return;
    }
    if (!this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          console.debug("UserStateChanged:", user);
          this.conversationList();
          this.periodicEvent = interval(10000).subscribe(() => {
            this.pollForNewConversations();
          });
        }
      });
    } else if (this.store.state.user.accessToken) {
      this.conversationList();
      this.periodicEvent = interval(10000).subscribe(() => {
        this.pollForNewConversations();
      });
    }
  },
};
</script>

<style lang="less" scoped>
@import "../assets/style/colors";
@import "../assets/style/fonts";

.conversation-table-container {
  margin: auto;
  max-width: 700px;
  padding: 0 16px;

  @media screen and (max-width: 640px) {
    max-width: 100%;
    padding: 0 12px;
  }
}

// View Switcher
.view-switcher {
  margin-bottom: 16px;
  padding-top: 8px;

  :deep(.p-selectbutton) {
    width: 100%;
    display: flex;
  }

  :deep(.p-selectbutton .p-button) {
    flex: 1;
    justify-content: center;
  }
}

.view-option {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;

  i {
    font-size: 14px;
  }
}

.unread-badge {
  background: @mrcall_blue;
  color: @mrcall_white;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  line-height: 1.4;
}

// Filters Card
.filters-card {
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
}

.filters-header {
  background: @mrcall_light_grey_2;
  padding: 12px 16px;
  border-bottom: 1px solid @mrcall_borders;
}

.filters-title {
  font-weight: 600;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}

.filters-content {
  padding: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid @mrcall_light_grey_2;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }

  @media screen and (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  font-size: 14px;
  color: @mrcall_grey_text;
  font-weight: 500;

  i {
    font-size: 14px;
    color: @mrcall_grey_text2;
  }

  @media screen and (max-width: 640px) {
    min-width: auto;
  }
}

.filter-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;

  @media screen and (max-width: 640px) {
    width: 100%;
  }
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: @mrcall_light_grey_2;
  border-radius: 50%;
  cursor: pointer;
  color: @mrcall_grey_text;
  transition: all 0.2s ease;

  &:hover {
    background: @mrcall_light_grey_1;
    color: @mrcall_dark_grey_text;
  }

  i {
    font-size: 12px;
  }
}

.export-buttons {
  display: flex;
  gap: 8px;

  @media screen and (max-width: 640px) {
    width: 100%;

    :deep(.p-button) {
      flex: 1;
    }
  }
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-label {
  font-size: 14px;
  color: @mrcall_grey_text;
}

// Conversation Cards
.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 0;
}

.conversation-card {
  background: @mrcall_white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid @mrcall_borders;
  transition: box-shadow 0.2s ease, opacity 0.3s ease, max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease;
  border-left: 4px solid @mrcall_light_grey_1;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  &.unread {
    border-left: 4px solid @mrcall_blue;

    .contact-name {
      font-weight: 700;
    }

    .timestamp-unread {
      color: @mrcall_blue;
      font-weight: 700;
    }
  }

  &.animating-out {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
    margin-bottom: 0;
    overflow: hidden;
    border-width: 0;
  }

  @media screen and (max-width: 640px) {
    padding: 12px;
    border-radius: 10px;
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.contact-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contact-name {
  font-weight: 600;
  font-size: 16px;
  color: @mrcall_black;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: @mrcall_blue;
  flex-shrink: 0;
}

.contact-number {
  font-size: 14px;
  color: @mrcall_grey_text;
}

.timestamp-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.timestamp {
  font-size: 13px;
  color: @mrcall_grey_text2;
  white-space: nowrap;
}

.duration {
  font-size: 12px;
  color: @mrcall_grey_text;
  white-space: nowrap;
}

// Card Actions
.desktop-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  @media screen and (max-width: 640px) {
    display: none;
  }
}

.mobile-action-trigger {
  display: none;
  flex-shrink: 0;

  @media screen and (max-width: 640px) {
    display: flex;
  }
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: @mrcall_grey_text;
  transition: all 0.15s ease;

  &:hover {
    background: @mrcall_light_grey_2;
    color: @mrcall_dark_grey_text;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  i {
    font-size: 14px;
  }
}

.action-btn-danger {
  &:hover {
    background: #fef2f2;
    color: #dc2626;
  }
}

.btn-delete-all {
  &:deep(.p-button) {
    background: @mrcall_orange;
    border-color: @mrcall_orange;
    color: @mrcall_black;
  }
}

:deep(.btn-delete-all) {
  background: @mrcall_orange !important;
  border-color: @mrcall_orange !important;
  color: @mrcall_black !important;

  &:hover {
    background: darken(@mrcall_orange, 10%) !important;
    border-color: darken(@mrcall_orange, 10%) !important;
  }
}

.action-btn-read {
  color: @mrcall_black;
  flex-shrink: 0;

  &:hover {
    background: @mrcall_light_grey_2;
    color: @mrcall_dark_grey_text;
  }
}

.card-body {
  margin-bottom: 12px;
}

.message-preview {
  font-size: 14px;
  line-height: 1.6;
  color: @mrcall_dark_grey_text;
  word-break: break-word;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &.message-collapsed {
    .transcript-message:nth-child(n + 3) {
      display: none;
    }
  }
}

.transcript-message {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 8px;
}

.transcript-agent {
  background: @mrcall_light_grey_2;
  align-self: flex-start;
  max-width: 85%;
}

.transcript-user {
  background: #e8f4fd;
  align-self: flex-end;
  max-width: 85%;
}

.transcript-alias {
  font-size: 12px;
  font-weight: 600;
  color: @mrcall_grey_text;
}

.transcript-content {
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}

.expand-btn {
  background: none;
  border: none;
  color: @mrcall_grey_text;
  font-size: 14px;
  font-weight: 500;
  padding: 4px 0;
  cursor: pointer;
  margin-top: 4px;

  &:hover {
    text-decoration: underline;
  }
}

.card-audio {
  margin-top: 12px;

  audio {
    width: 100%;
    height: 40px;
  }
}

// Empty State
.empty-state {
  text-align: center;
  padding: 60px 20px;

  .empty-icon {
    font-size: 48px;
    color: @mrcall_light_grey_1;
    margin-bottom: 16px;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
    margin-bottom: 8px;
  }

  .empty-description {
    font-size: 14px;
    color: @mrcall_grey_text;
    max-width: 300px;
    margin: 0 auto;
  }
}

// Loading Skeleton
.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 0;
}

.skeleton-card {
  background: @mrcall_white;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid @mrcall_borders;
}

.skeleton-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  background: @mrcall_light_grey_2;
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-name {
  width: 120px;
  height: 18px;
}

.skeleton-number {
  width: 100px;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-short {
  width: 70%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
